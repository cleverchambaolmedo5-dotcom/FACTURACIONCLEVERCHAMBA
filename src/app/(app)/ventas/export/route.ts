import { requireModuleAccess } from "@/lib/auth/guards";
import { listSalesForExportForUser } from "@/server/services/sale-service";
import type { SaleExportRow } from "@/server/services/sale-service";
import { buildXlsxFile, xlsxResponse, exportTimestamp } from "@/server/services/excel-export";

const STATUS_LABELS: Record<SaleExportRow["status"], string> = {
  // Mirrors sale-table.tsx's own relabeling -- ACTIVE means "no payment
  // approved yet", shown as "Pendiente" everywhere in Ventas.
  ACTIVE: "Pendiente",
  PARTIALLY_PAID: "Parcialmente pagada",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

// requireModuleAccess("ventas") gates page-level access (ADMIN/ACCOUNTANT/
// SELLER, see rbac.ts); listSalesForExportForUser is the authoritative
// check that only ADMIN/ACCOUNTANT ever get rows back -- this export is
// the accounting reconciliation file, not the general Ventas listing a
// SELLER already sees on-screen.
export async function GET(request: Request) {
  const user = await requireModuleAccess("ventas");

  const { searchParams } = new URL(request.url);
  const rows = await listSalesForExportForUser(user, {
    search: searchParams.get("q") ?? undefined,
    productId: searchParams.get("productId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    sellerId: searchParams.get("sellerId") ?? undefined,
  });

  const buffer = await buildXlsxFile<SaleExportRow>(
    "Ventas",
    [
      { header: "Fecha de venta", width: 16, value: (row) => row.saleDate, numFmt: "dd/mm/yyyy" },
      { header: "N° de venta", width: 38, value: (row) => row.id },
      { header: "Cliente", width: 28, value: (row) => row.customerName },
      { header: "Producto", width: 24, value: (row) => row.productName },
      { header: "Vendedor", width: 22, value: (row) => row.sellerName },
      {
        header: "Valor total",
        width: 14,
        numFmt: "#,##0.00",
        value: (row) => row.finalPriceCents / 100,
      },
      {
        header: "Total pagado",
        width: 14,
        numFmt: "#,##0.00",
        value: (row) => row.paidCents / 100,
      },
      {
        header: "Saldo pendiente",
        width: 16,
        numFmt: "#,##0.00",
        value: (row) => row.balanceCents / 100,
      },
      { header: "Estado de pago", width: 20, value: (row) => STATUS_LABELS[row.status] },
    ],
    rows,
  );

  return xlsxResponse(buffer, `ventas-${exportTimestamp()}.xlsx`);
}
