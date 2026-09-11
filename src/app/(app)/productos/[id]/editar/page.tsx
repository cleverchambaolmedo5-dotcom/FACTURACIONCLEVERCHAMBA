import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import { getProductForAdmin } from "@/server/services/product-service";
import { ProductForm } from "@/components/products/product-form";
import { updateProductAction } from "../../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Editar producto · ${siteConfig.name}` };

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModuleAccess("productos");
  const { id } = await params;

  // getProductForAdmin re-checks ADMIN on its own (defense in depth, see
  // product-service.ts) -- a non-ADMIN never reaches here in the first
  // place, requireModuleAccess("productos") already redirected.
  const product = await getProductForAdmin(user, id);
  if (!product) {
    notFound();
  }

  const boundAction = updateProductAction.bind(null, product.id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Editar producto</h2>
        <p className="text-sm text-muted-foreground">{product.name}</p>
      </div>

      <ProductForm
        action={boundAction}
        mode="edit"
        submitLabel="Guardar cambios"
        defaults={{
          name: product.name,
          description: product.description ?? "",
          officialPrice: product.officialPrice.toString(),
          currency: product.currency,
          type: product.type,
          active: product.active,
        }}
      />
    </div>
  );
}
