import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  getInstallmentForUser,
  listBankAccountsForPaymentForm,
  findRejectedPaymentNeedingCorrection,
} from "@/server/services/payment-service";
import { getCardPaymentBankAccountForSaleForm } from "@/server/services/sale-service";
import { requireModuleAccess } from "@/lib/auth/guards";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { InstallmentStatus } from "@/generated/prisma/enums";
import { PaymentForm } from "@/components/payments/payment-form";
import { PaymentHistory } from "@/components/payments/payment-history";
import { registerPaymentAction } from "../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Detalle de cuota · ${siteConfig.name}` };

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "UTC" });
const rejectedAtFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const STATUS_TONE: Record<InstallmentStatus, StatusTone> = {
  PENDING: "pending",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "error",
};

const STATUS_LABELS: Record<InstallmentStatus, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
};

export default async function CuotaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModuleAccess("pagos");
  const { id } = await params;

  // Record-level permission (a SELLER only ever gets installments on
  // their own sales back) is enforced inside getInstallmentForUser. An
  // installment that doesn't exist and one that exists but isn't the
  // SELLER's look identical here on purpose -- both render the same 404,
  // revealing nothing about other sellers' data.
  const installment = await getInstallmentForUser(user, id);
  if (!installment) {
    notFound();
  }

  const boundAction = registerPaymentAction.bind(null, installment.id);
  const today = new Date().toISOString().slice(0, 10);
  const [bankAccounts, cardBankAccount] = await Promise.all([
    listBankAccountsForPaymentForm(),
    getCardPaymentBankAccountForSaleForm(),
  ]);

  // Same "still-open rejection" rule as the seller dashboard alert (see
  // payment-service.ts#findRejectedPaymentNeedingCorrection) -- null once a
  // newer payment supersedes it or the cuota is already fully paid, so this
  // banner and the dashboard alert never disagree about a given cuota.
  const rejectedPayment = findRejectedPaymentNeedingCorrection(
    installment.payments,
    installment.balanceCents,
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Cuota N.° {installment.installmentNumber}
          </h2>
          <p className="text-sm text-muted-foreground">
            {installment.sale.customer.fullName} · {installment.sale.product.name} · Vendedor:{" "}
            {installment.sale.seller.name}
          </p>
        </div>
        <StatusBadge tone={STATUS_TONE[installment.effectiveStatus]}>
          {STATUS_LABELS[installment.effectiveStatus]}
        </StatusBadge>
      </div>

      {rejectedPayment && (
        <div className="flex flex-col gap-2 rounded-lg border border-error/30 bg-error-soft p-4">
          <div className="flex items-center gap-2 text-error">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            <p className="text-sm font-semibold">Estado: Pago rechazado</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Motivo del rechazo
            </p>
            <p className="text-sm text-foreground">{rejectedPayment.rejectionReason || "—"}</p>
          </div>
          {rejectedPayment.validatedAt && (
            <p className="text-xs text-muted-foreground">
              Rechazado el {rejectedAtFormatter.format(rejectedPayment.validatedAt)}
            </p>
          )}
          <a href="#registrar-pago" className={buttonVariants({ variant: "danger", size: "sm", className: "w-fit" })}>
            Registrar nuevamente el pago
          </a>
        </div>
      )}

      <Card padding="lg" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor total</dt>
          <dd className="text-lg font-semibold text-foreground">
            {currencyFormatter.format(installment.totalCents / 100)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pagado aprobado</dt>
          <dd className="text-lg font-semibold text-foreground">
            {currencyFormatter.format(installment.paidCents / 100)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pendiente de validación
          </dt>
          <dd className="text-lg font-semibold text-warning">
            {currencyFormatter.format(installment.pendingCents / 100)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo</dt>
          <dd className="text-lg font-bold text-primary">
            {currencyFormatter.format(installment.balanceCents / 100)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vencimiento</dt>
          <dd className="text-lg font-semibold text-foreground">{dateFormatter.format(installment.dueDate)}</dd>
        </div>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {rejectedPayment ? "Corregir pago" : "Registrar pago"}
        </h3>
        {installment.balanceCents > 0 ? (
          <PaymentForm
            action={boundAction}
            balanceCents={installment.balanceCents}
            defaultPaymentDate={today}
            bankAccounts={bankAccounts}
            cardBankAccount={cardBankAccount}
          />
        ) : (
          <p className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            Esta cuota ya está completamente pagada.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Historial de pagos</h3>
        <PaymentHistory payments={installment.payments} viewerRole={user.role} />
      </div>
    </div>
  );
}
