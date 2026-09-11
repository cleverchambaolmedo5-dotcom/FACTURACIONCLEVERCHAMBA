import type { Metadata } from "next";
import { requireModuleAccess } from "@/lib/auth/guards";
import { ProductForm } from "@/components/products/product-form";
import { createProductAction } from "../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Nuevo producto · ${siteConfig.name}` };

export default async function NuevoProductoPage() {
  await requireModuleAccess("productos");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Nuevo producto</h2>
        <p className="text-sm text-muted-foreground">
          Completa los datos del curso, mentoría o asesoría. Se crea activo por defecto.
        </p>
      </div>

      <ProductForm action={createProductAction} mode="create" submitLabel="Crear producto" />
    </div>
  );
}
