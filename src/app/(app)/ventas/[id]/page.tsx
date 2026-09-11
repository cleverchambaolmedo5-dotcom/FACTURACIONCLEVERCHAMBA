import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import { getSaleForUser } from "@/server/services/sale-service";
import { computeInstallmentTotals } from "@/server/services/payment-service";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { SaleInstallments } from "@/components/sales/sale-installments";
import { PaymentHistory } from "@/components/payments/payment-history";
import { ReceiptLink } from "@/components/payments/receipt-link";
import { SaleStatus } from "@/generated/prisma/enums";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Detalle de venta · ${siteConfig.name}` };

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const STATUS_TONE: Record<SaleStatus, StatusTone> = {
  ACTIVE: "pending",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "error",
  CANCELLED: "neutral",
};

const STATUS_LABELS: Record<SaleStatus, string> = {
  // Mirrors sale-table.tsx's own relabeling -- ACTIVE means "no payment
  // approved yet", shown as "Pendiente" everywhere in Ventas.
  ACTIVE: "Pendiente",
  PARTIALLY_PAID: "Parcialmente pagada",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

export default async function VentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModuleAccess("ventas");
  const { id } = await params;

  // Record-level permission (a SELLER only ever gets their own sale back)
  // is enforced inside getSaleForUser. A sale that doesn't exist and one
  // that exists but isn't the SELLER's look identical here on purpose --
  // both render the same 404, revealing nothing about other sellers' data.
  const sale = await getSaleForUser(user, id);
  if (!sale) {
    notFound();
  }

  // Same "cents are the source of truth" totals used everywhere else in
  // Ventas/Cuotas (see sale-service.ts#decorateSaleListItem) -- computed
  // once here and reused for both the RESUMEN block and the per-cuota
  // PAGOS section below, never re-derived separately.
  const now = new Date();
  const decoratedInstallments = sale.installments.map((installment) =>
    computeInstallmentTotals(installment, now),
  );
  const finalPriceCents = Math.round(Number(sale.finalPrice) * 100);
  const paidCents = decoratedInstallments.reduce((sum, installment) => sum + installment.paidCents, 0);
  const balanceCents = finalPriceCents - paidCents;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Detalle de venta</h2>
          <p className="text-sm text-muted-foreground">
            {sale.customer.fullName} · {sale.product.name}
          </p>
        </div>
        <StatusBadge tone={STATUS_TONE[sale.status]}>{STATUS_LABELS[sale.status]}</StatusBadge>
      </div>

      <Card padding="lg" className="grid gap-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cliente</dt>
          <dd className="text-sm text-foreground">{sale.customer.fullName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Producto</dt>
          <dd className="text-sm text-foreground">{sale.product.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Número de cuotas
          </dt>
          <dd className="text-sm text-foreground">{sale.installments.length}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Precio final
          </dt>
          <dd className="text-2xl font-bold text-primary">{currencyFormatter.format(Number(sale.finalPrice))}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total pagado</dt>
          <dd className="text-2xl font-bold text-success">{currencyFormatter.format(paidCents / 100)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Saldo pendiente
          </dt>
          <dd className="text-2xl font-bold text-foreground">
            {balanceCents > 0 ? currencyFormatter.format(balanceCents / 100) : "$0,00"}
          </dd>
        </div>
        <div className="border-t border-border sm:col-span-3" />
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vendedor</dt>
          <dd className="text-sm text-foreground">{sale.seller.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fecha de venta
          </dt>
          <dd className="text-sm text-foreground">{dateFormatter.format(sale.saleDate)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cuenta bancaria de destino
          </dt>
          <dd className="text-sm text-foreground">
            {sale.bankAccount
              ? `${sale.bankAccount.bankName} — ${sale.bankAccount.alias}`
              : "Sin cuenta asignada"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Precio original
          </dt>
          <dd className="text-sm text-foreground">{currencyFormatter.format(Number(sale.originalPrice))}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descuento</dt>
          <dd className="text-sm text-foreground">{currencyFormatter.format(Number(sale.discount))}</dd>
        </div>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Comprobante de venta</h3>
        {sale.receipt ? (
          <Card padding="md" className="flex items-center justify-between">
            <p className="text-sm text-foreground">{sale.receipt.fileName}</p>
            <ReceiptLink fileUrl={sale.receipt.fileUrl} />
          </Card>
        ) : (
          <p className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            Esta venta no tiene comprobante adjunto.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Cuotas</h3>
        <SaleInstallments installments={decoratedInstallments} />
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-foreground">Pagos</h3>
        {decoratedInstallments.map((installment) => (
          <div key={installment.id} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cuota {installment.installmentNumber} · {currencyFormatter.format(installment.totalCents / 100)}
            </p>
            <PaymentHistory payments={installment.payments} viewerRole={user.role} />
          </div>
        ))}
      </div>
    </div>
  );
}
