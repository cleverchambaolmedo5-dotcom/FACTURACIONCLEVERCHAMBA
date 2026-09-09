import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import { getPaymentForUser } from "@/server/services/payment-service";
import { PaymentMethod } from "@/generated/prisma/enums";
import { ValidationStatusBadge } from "@/components/payments/validation-status-badge";
import { ReceiptLink } from "@/components/payments/receipt-link";
import { PaymentValidationPanel } from "@/components/payments/payment-validation-panel";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Detalle de comprobante · ${siteConfig.name}` };

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  DEPOSIT: "Depósito",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

export default async function ComprobanteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // MODULE_ACCESS in rbac.ts keeps SELLER out of this module entirely.
  const user = await requireModuleAccess("comprobantes");
  const { id } = await params;

  const payment = await getPaymentForUser(user, id);
  if (!payment) {
    notFound();
  }

  const { installment } = payment;
  const { sale } = installment;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link
        href="/comprobantes"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a comprobantes
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Detalle del comprobante</h2>
          <p className="text-sm text-muted-foreground">
            {sale.customer.fullName} · {sale.product.name} · Cuota N.° {installment.installmentNumber}
          </p>
        </div>
        <ValidationStatusBadge status={payment.validationStatus} />
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-surface p-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cliente</dt>
          <dd className="text-sm text-foreground">{sale.customer.fullName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Producto / Venta
          </dt>
          <dd className="text-sm text-foreground">
            <Link href={`/ventas/${sale.id}`} className="text-primary hover:underline">
              {sale.product.name}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cuota</dt>
          <dd className="text-sm text-foreground">
            <Link href={`/pagos/${installment.id}`} className="text-primary hover:underline">
              N.° {installment.installmentNumber}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monto</dt>
          <dd className="text-lg font-semibold text-foreground">
            {currencyFormatter.format(Number(payment.amount))}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Método de pago
          </dt>
          <dd className="text-sm text-foreground">{METHOD_LABELS[payment.method]}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fecha de pago
          </dt>
          <dd className="text-sm text-foreground">{dateFormatter.format(payment.paymentDate)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Referencia</dt>
          <dd className="text-sm text-foreground">{payment.reference || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Observaciones
          </dt>
          <dd className="text-sm text-foreground">{payment.notes || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Registrado por
          </dt>
          <dd className="text-sm text-foreground">{payment.registeredBy.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Comprobante
          </dt>
          <dd className="text-sm">
            {payment.receipt ? (
              <ReceiptLink fileUrl={payment.receipt.fileUrl} />
            ) : (
              <span className="text-muted-foreground">Sin comprobante adjunto</span>
            )}
          </dd>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-surface p-6 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Valor de la cuota
          </dt>
          <dd className="text-lg font-semibold text-foreground">
            {currencyFormatter.format(payment.installmentTotalCents / 100)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Aprobado hasta ahora
          </dt>
          <dd className="text-lg font-semibold text-foreground">
            {currencyFormatter.format(payment.installmentApprovedCents / 100)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Saldo de la cuota
          </dt>
          <dd className="text-lg font-bold text-primary">
            {currencyFormatter.format(payment.installmentBalanceCents / 100)}
          </dd>
        </div>
      </div>

      {payment.validationStatus === "PENDING_VALIDATION" ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Validar pago</h3>
          <PaymentValidationPanel paymentId={payment.id} />
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-6">
          <h3 className="text-sm font-semibold text-foreground">Resultado de la validación</h3>
          <p className="text-sm text-muted-foreground">
            {payment.validationStatus === "APPROVED" ? "Aprobado" : "Rechazado"} por{" "}
            {payment.validatedBy?.name ?? "—"}
            {payment.validatedAt ? ` el ${dateFormatter.format(payment.validatedAt)}` : ""}.
          </p>
          {payment.validationStatus === "REJECTED" && payment.rejectionReason && (
            <p className="text-sm text-error">Motivo: {payment.rejectionReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
