import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import { getInvestmentForUser } from "@/server/services/investment-service";
import { UserRole } from "@/generated/prisma/enums";
import { InvestmentStatusBadge } from "@/components/investments/investment-status";
import { InvestmentValidationPanel } from "@/components/investments/investment-validation-panel";
import { InvestmentCancelPanel } from "@/components/investments/investment-cancel-panel";
import { ReceiptLink } from "@/components/payments/receipt-link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Detalle de inversión · ${siteConfig.name}` };

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const percentFormatter = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function InversionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModuleAccess("inversiones");
  const { id } = await params;

  // Record-level permission (a SELLER only ever gets their own investment
  // back) AND field-level financial restriction are both enforced inside
  // getInvestmentForUser. An investment that doesn't exist and one that
  // exists but isn't the SELLER's look identical here on purpose -- both
  // render the same 404, revealing nothing about other sellers' data.
  const result = await getInvestmentForUser(user, id);
  if (!result) {
    notFound();
  }

  if (result.view === "seller") {
    // SELLER view: never receives principalAmount, annualRate, or any
    // other financial data from the server -- not just hidden here, the
    // query itself (investmentRepository.findInvestmentForSeller) never
    // selected those columns.
    const { investment } = result;
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Detalle de inversión</h2>
            <p className="text-sm text-muted-foreground">{investment.customer.fullName}</p>
          </div>
          <InvestmentStatusBadge status={investment.status} />
        </div>

        <div className="grid gap-4 rounded-lg border border-border bg-surface p-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Inversionista
            </dt>
            <dd className="text-sm text-foreground">{investment.customer.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vendedor
            </dt>
            <dd className="text-sm text-foreground">{investment.seller.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fecha de inicio
            </dt>
            <dd className="text-sm text-foreground">{dateFormatter.format(investment.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Primer rendimiento
            </dt>
            <dd className="text-sm text-foreground">{dateFormatter.format(investment.firstReturnDate)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vencimiento
            </dt>
            <dd className="text-sm text-foreground">{dateFormatter.format(investment.maturityDate)}</dd>
          </div>
        </div>
      </div>
    );
  }

  // ADMIN/ACCOUNTANT view: full financial data.
  const { investment } = result;
  const canValidate = user.role === UserRole.ADMIN || user.role === UserRole.ACCOUNTANT;
  const canCancel = user.role === UserRole.ADMIN;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Detalle de inversión</h2>
          <p className="text-sm text-muted-foreground">{investment.customer.fullName}</p>
        </div>
        <InvestmentStatusBadge status={investment.status} />
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-surface p-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Inversionista
          </dt>
          <dd className="text-sm text-foreground">{investment.customer.fullName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Identificación
          </dt>
          <dd className="text-sm text-foreground">{investment.customer.identification}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Teléfono
          </dt>
          <dd className="text-sm text-foreground">{investment.customer.phone}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dirección
          </dt>
          <dd className="text-sm text-foreground">{investment.customer.address || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Vendedor
          </dt>
          <dd className="text-sm text-foreground">{investment.seller.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fecha de inicio
          </dt>
          <dd className="text-sm text-foreground">{dateFormatter.format(investment.startDate)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Primer rendimiento
          </dt>
          <dd className="text-sm text-foreground">{dateFormatter.format(investment.firstReturnDate)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Vencimiento
          </dt>
          <dd className="text-sm text-foreground">{dateFormatter.format(investment.maturityDate)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tasa anual
          </dt>
          <dd className="text-sm text-foreground">{percentFormatter.format(Number(investment.annualRate))}%</dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Monto invertido
          </dt>
          <dd className="text-2xl font-bold text-primary">
            {currencyFormatter.format(Number(investment.principalAmount))}
          </dd>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Comprobante de ingreso</h3>
          {investment.receipt ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
              <p className="text-sm text-foreground">{investment.receipt.fileName}</p>
              <ReceiptLink fileUrl={investment.receipt.fileUrl} />
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-black/[0.02] px-4 py-3 text-sm text-muted-foreground">
              Esta inversión no tiene comprobante adjunto.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Contrato</h3>
          {investment.contract ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
              <p className="text-sm text-foreground">{investment.contract.fileName}</p>
              <ReceiptLink fileUrl={investment.contract.fileUrl} />
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-black/[0.02] px-4 py-3 text-sm text-muted-foreground">
              No se ha subido un contrato para esta inversión.
            </p>
          )}
        </div>
      </div>

      {investment.status === "PENDING_VALIDATION" && canValidate && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Validar inversión</h3>
          <InvestmentValidationPanel investmentId={investment.id} />
        </div>
      )}

      {investment.status !== "PENDING_VALIDATION" && (investment.validatedAt || investment.status === "REJECTED") && (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-6">
          <h3 className="text-sm font-semibold text-foreground">Resultado de la validación</h3>
          <p className="text-sm text-muted-foreground">
            {investment.status === "REJECTED" ? "Rechazada" : "Aprobada"}
            {investment.validatedAt ? ` el ${dateFormatter.format(investment.validatedAt)}` : ""}.
          </p>
          {investment.status === "REJECTED" && investment.rejectionReason && (
            <p className="text-sm text-error">Motivo: {investment.rejectionReason}</p>
          )}
        </div>
      )}

      {investment.status === "CANCELLED" && (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-6">
          <h3 className="text-sm font-semibold text-foreground">Cancelación anticipada</h3>
          <p className="text-sm text-muted-foreground">
            {investment.cancelledAt ? `Cancelada el ${dateFormatter.format(investment.cancelledAt)}.` : "Cancelada."}
          </p>
          {investment.cancellationReason && (
            <p className="text-sm text-error">Motivo: {investment.cancellationReason}</p>
          )}
        </div>
      )}

      {investment.status === "ACTIVE" && canCancel && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Administración</h3>
          <InvestmentCancelPanel investmentId={investment.id} />
        </div>
      )}
    </div>
  );
}
