import type { Metadata } from "next";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserRole } from "@/generated/prisma/enums";
import {
  getFinancialInvestmentDashboardData,
  getSellerInvestmentDashboardData,
} from "@/server/services/dashboard-service";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { AccountantDashboard } from "@/components/dashboard/accountant-dashboard";
import { SellerDashboard } from "@/components/dashboard/seller-dashboard";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: `Dashboard · ${siteConfig.name}`,
};

// Logging out lives in the Header's user menu (shared across every
// authenticated route), not here. requireModuleAccess("dashboard") is the
// only auth/session check on this page -- the role-specific data fetchers
// below (dashboard-service.ts) reuse the same scoping rules already
// enforced by investment-service.ts, so there is no second, parallel
// permission check for SELLER row-level/field-level data anywhere in here.
//
// This dashboard reflects the Inversiones module -- see dashboard-service.ts
// for why it no longer shows Ventas/Pagos/Comprobantes/Productos data.
export default async function DashboardPage() {
  const user = await requireModuleAccess("dashboard");

  if (user.role === UserRole.ADMIN) {
    const data = await getFinancialInvestmentDashboardData(user);
    return <AdminDashboard user={user} data={data} />;
  }

  if (user.role === UserRole.ACCOUNTANT) {
    const data = await getFinancialInvestmentDashboardData(user);
    return <AccountantDashboard user={user} data={data} />;
  }

  const data = await getSellerInvestmentDashboardData(user);
  return <SellerDashboard user={user} data={data} />;
}
