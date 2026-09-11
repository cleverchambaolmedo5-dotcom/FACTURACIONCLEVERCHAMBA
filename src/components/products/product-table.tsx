import Link from "next/link";
import { Pencil } from "lucide-react";
import { ProductType } from "@/generated/prisma/enums";
import type { ProductListItem } from "@/server/repositories/product-repository";
import { ProductStatusBadge } from "./product-status-badge";
import { ProductToggleStatusButton } from "./product-toggle-status-button";
import { ProductDeleteButton } from "./product-delete-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });
const amountFormatter = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Mirrors product-form.tsx's own PRODUCT_TYPE_LABELS -- duplicated rather
// than shared since these are two separate components, same pattern as the
// method-label maps duplicated between sale-form.tsx/payment-form.tsx.
const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  COURSE: "Curso",
  MENTORING: "Mentoría",
  WORKSHOP: "Taller",
  CONSULTING: "Asesoría",
};

// Only ever rendered on /productos, which requireModuleAccess("productos")
// already restricts to ADMIN alone (see rbac.ts) -- unlike CustomerTable,
// there's no per-row role branching needed here, mirroring UserTable.
export function ProductTable({ products }: { products: ProductListItem[] }) {
  return (
    <Table className="min-w-[940px]">
      <TableHeader>
        <tr>
          <TableHead>Nombre</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Precio</TableHead>
          <TableHead>Moneda</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Fecha de creación</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell className="font-medium text-foreground">{product.name}</TableCell>
            <TableCell className="max-w-xs truncate text-muted-foreground">
              {product.description ?? "—"}
            </TableCell>
            <TableCell>
              <StatusBadge tone="neutral">{PRODUCT_TYPE_LABELS[product.type]}</StatusBadge>
            </TableCell>
            <TableCell className="font-semibold text-foreground">
              {amountFormatter.format(Number(product.officialPrice))}
            </TableCell>
            <TableCell className="text-muted-foreground">{product.currency}</TableCell>
            <TableCell>
              <ProductStatusBadge active={product.active} />
            </TableCell>
            <TableCell className="text-muted-foreground">{dateFormatter.format(product.createdAt)}</TableCell>
            <TableCell className="text-right">
              <div className="inline-flex items-center justify-end gap-1">
                <Link
                  href={`/productos/${product.id}/editar`}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Editar
                </Link>
                <ProductToggleStatusButton productId={product.id} active={product.active} />
                <ProductDeleteButton productId={product.id} active={product.active} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
