import type { Metadata } from "next";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserRole } from "@/generated/prisma/enums";
import {
  getFinancialSalesDashboardData,
  getSellerSalesDashboardData,
  getBankAccountsSummaryForUser,
} from "@/server/services/dashboard-service";
import { SalesAdminDashboard } from "@/components/dashboard/sales-admin-dashboard";
import { SalesAccountantDashboard } from "@/components/dashboard/sales-accountant-dashboard";
import { SalesSellerDashboard } from "@/components/dashboard/sales-seller-dashboard";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: `Dashboard de Ventas · ${siteConfig.name}`,
};

// Mirrors src/app/(app)/dashboard/page.tsx (the Inversiones dashboard) one
// level over, for the Ventas module: same requireModuleAccess("dashboard")
// key (shared across both modules, see MODULE_ACCESS.dashboard in rbac.ts),
// same per-role branching, but every number here comes from
// dashboard-service.ts's Ventas section (listSalesForUser/
// listPendingPaymentsForUser) -- never from Inversiones data.
export default async function DashboardVentasPage() {
  const user = await requireModuleAccess("dashboard");

  if (user.role === UserRole.ADMIN) {
    const [data, bankAccounts] = await Promise.all([
      getFinancialSalesDashboardData(user),
      getBankAccountsSummaryForUser(user),
    ]);
    return <SalesAdminDashboard user={user} data={data} bankAccounts={bankAccounts} />;
  }

  if (user.role === UserRole.ACCOUNTANT) {
    const [data, bankAccounts] = await Promise.all([
      getFinancialSalesDashboardData(user),
      getBankAccountsSummaryForUser(user),
    ]);
    return <SalesAccountantDashboard user={user} data={data} bankAccounts={bankAccounts} />;
  }

  const data = await getSellerSalesDashboardData(user);
  return <SalesSellerDashboard user={user} data={data} />;
}
