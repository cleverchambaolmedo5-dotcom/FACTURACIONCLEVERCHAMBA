import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserRole } from "@/generated/prisma/enums";
import {
  listProductsForSaleForm,
  listSellersForSaleForm,
  listBankAccountsForSaleForm,
} from "@/server/services/sale-service";
import { SaleForm } from "@/components/sales/sale-form";
import {
  createSaleAction,
  createCustomerForSaleAction,
  searchCustomersForSaleAction,
} from "../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Nueva venta · ${siteConfig.name}` };

// UTC-based so it matches how sale-service parses "YYYY-MM-DD" dates --
// see parseDateOnly() there for why this avoids local-timezone drift.
function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function NuevaVentaPage() {
  const user = await requireModuleAccess("ventas");

  // ACCOUNTANT can view sales but never create them. The service layer is
  // the authoritative check on submission; this just avoids showing a
  // form the role isn't allowed to submit.
  if (user.role === UserRole.ACCOUNTANT) {
    redirect("/acceso-denegado");
  }

  const [products, sellers, bankAccounts] = await Promise.all([
    listProductsForSaleForm(),
    user.role === UserRole.ADMIN ? listSellersForSaleForm() : Promise.resolve([]),
    listBankAccountsForSaleForm(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Nueva venta</h2>
        <p className="text-sm text-muted-foreground">
          Completa los datos para registrar una nueva venta.
        </p>
      </div>

      <SaleForm
        action={createSaleAction}
        role={user.role}
        currentUserName={user.name}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          officialPrice: Number(product.officialPrice),
        }))}
        sellers={sellers}
        bankAccounts={bankAccounts.map((account) => ({
          id: account.id,
          bankName: account.bankName,
          alias: account.alias,
          accountHolder: account.accountHolder,
          accountNumber: account.accountNumber,
        }))}
        defaultSaleDate={todayDateOnly()}
        searchCustomersAction={searchCustomersForSaleAction}
        createCustomerAction={createCustomerForSaleAction}
      />
    </div>
  );
}
