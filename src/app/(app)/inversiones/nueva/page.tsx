import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserRole } from "@/generated/prisma/enums";
import { listSellersForInvestmentForm } from "@/server/services/investment-service";
import { InvestmentForm } from "@/components/investments/investment-form";
import {
  createInvestmentAction,
  createCustomerForInvestmentAction,
  searchCustomersForInvestmentAction,
} from "../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Nueva inversión · ${siteConfig.name}` };

// UTC-based so it matches how investment-service parses "YYYY-MM-DD" dates.
function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function NuevaInversionPage() {
  const user = await requireModuleAccess("inversiones");

  // ACCOUNTANT can view/validate investments but never create them. The
  // service layer is the authoritative check on submission; this just
  // avoids showing a form the role isn't allowed to submit.
  if (user.role === UserRole.ACCOUNTANT) {
    redirect("/acceso-denegado");
  }

  const sellers = user.role === UserRole.ADMIN ? await listSellersForInvestmentForm() : [];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Nueva inversión</h2>
        <p className="text-sm text-muted-foreground">
          Completa los datos para registrar una nueva inversión.
        </p>
      </div>

      <InvestmentForm
        action={createInvestmentAction}
        role={user.role}
        currentUserName={user.name}
        sellers={sellers}
        defaultStartDate={todayDateOnly()}
        searchCustomersAction={searchCustomersForInvestmentAction}
        createCustomerAction={createCustomerForInvestmentAction}
      />
    </div>
  );
}
