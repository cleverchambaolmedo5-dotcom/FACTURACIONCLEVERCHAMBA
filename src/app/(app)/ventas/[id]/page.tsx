import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import { getSaleForUser } from "@/server/services/sale-service";
import { computeInstallmentTotals } from "@/server/services/payment-service";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { SaleInstallments } from "@/components/sales/sale-installments";
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
  ACTIVE: "Activa",
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

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Detalle de venta</h2>
          <p className="text-sm text-muted-foreground">
            {sale.customer.fullName} · {sale.product.name}
          </p>
        </div>
        <StatusBadge tone={STATUS_TONE[sale.status]}>{STATUS_LABELS[sale.status]}</StatusBadge>
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-surface p-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cliente</dt>
          <dd className="text-sm text-foreground">{sale.customer.fullName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Producto</dt>
          <dd className="text-sm text-foreground">{sale.product.name}</dd>
        </div>
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
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Precio final
          </dt>
          <dd className="text-2xl font-bold text-primary">{currencyFormatter.format(Number(sale.finalPrice))}</dd>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Comprobante de venta</h3>
        {sale.receipt ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-foreground">{sale.receipt.fileName}</p>
            <ReceiptLink fileUrl={sale.receipt.fileUrl} />
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-black/[0.02] px-4 py-3 text-sm text-muted-foreground">
            Esta venta no tiene comprobante adjunto.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Cuotas</h3>
        <SaleInstallments
          installments={sale.installments.map((installment) =>
            computeInstallmentTotals(installment, new Date()),
          )}
        />
      </div>
    </div>
  );
}
