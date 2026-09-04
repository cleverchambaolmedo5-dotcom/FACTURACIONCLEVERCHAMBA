import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ProductListItem } from "@/server/repositories/product-repository";
import { ProductStatusBadge } from "./product-status-badge";
import { ProductToggleStatusButton } from "./product-toggle-status-button";
import { ProductDeleteButton } from "./product-delete-button";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });
const amountFormatter = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Only ever rendered on /productos, which requireModuleAccess("productos")
// already restricts to ADMIN alone (see rbac.ts) -- unlike CustomerTable,
// there's no per-row role branching needed here, mirroring UserTable.
export function ProductTable({ products }: { products: ProductListItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Nombre</th>
              <th scope="col" className="px-4 py-3">Descripción</th>
              <th scope="col" className="px-4 py-3">Precio</th>
              <th scope="col" className="px-4 py-3">Moneda</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3">Fecha de creación</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium text-foreground">{product.name}</td>
                <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                  {product.description ?? "—"}
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">
                  {amountFormatter.format(Number(product.officialPrice))}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{product.currency}</td>
                <td className="px-4 py-3">
                  <ProductStatusBadge active={product.active} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {dateFormatter.format(product.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center justify-end gap-1">
                    <Link
                      href={`/productos/${product.id}/editar`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Editar
                    </Link>
                    <ProductToggleStatusButton productId={product.id} active={product.active} />
                    <ProductDeleteButton productId={product.id} active={product.active} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
