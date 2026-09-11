"use client";

import { useActionState } from "react";
import { ProductType } from "@/generated/prisma/enums";
import type { ProductFormState } from "@/app/(app)/productos/actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type ProductFormAction = (
  state: ProductFormState,
  formData: FormData,
) => Promise<ProductFormState>;

export type ProductFormDefaults = {
  name: string;
  description: string;
  officialPrice: string;
  currency: string;
  type: ProductType;
  active: boolean;
};

const EMPTY_DEFAULTS: ProductFormDefaults = {
  name: "",
  description: "",
  officialPrice: "",
  currency: "USD",
  type: ProductType.COURSE,
  active: true,
};

// Reuses the existing ProductType enum (see schema.prisma) rather than
// introducing a separate field -- maps directly onto "Cursos, Mentorías,
// Asesorías, Otros productos/servicios" from the module's scope.
const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  COURSE: "Curso",
  MENTORING: "Mentoría",
  WORKSHOP: "Taller",
  CONSULTING: "Asesoría",
};

/**
 * Shared create/edit form for the Productos module, mirroring
 * CustomerForm/UserForm's structure. `mode="edit"` additionally shows the
 * Estado field -- creation always starts a product ACTIVE (see
 * createProductForAdmin).
 */
export function ProductForm({
  action,
  mode,
  defaults = EMPTY_DEFAULTS,
  submitLabel,
}: {
  action: ProductFormAction;
  mode: "create" | "edit";
  defaults?: ProductFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    action,
    undefined,
  );
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;

  return (
    <Card padding="md" className="max-w-xl">
      <form action={formAction} className="space-y-4" noValidate>
        <Input
          id="name"
          name="name"
          label="Nombre"
          required
          defaultValue={defaults.name}
          disabled={pending}
          error={errors?.name}
        />

        <Textarea
          id="description"
          name="description"
          label="Descripción"
          helperText="Opcional."
          rows={3}
          defaultValue={defaults.description}
          disabled={pending}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="officialPrice"
            name="officialPrice"
            type="number"
            label="Precio"
            required
            min="0.01"
            step="0.01"
            defaultValue={defaults.officialPrice}
            disabled={pending}
            error={errors?.officialPrice}
            helperText={
              mode === "edit" && !errors?.officialPrice
                ? "Solo afecta a nuevas ventas; las ventas ya registradas conservan su precio histórico."
                : undefined
            }
          />

          <Input
            id="currency"
            name="currency"
            label="Moneda"
            required
            defaultValue={defaults.currency}
            disabled={pending}
            error={errors?.currency}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="type"
            name="type"
            label="Tipo"
            required
            defaultValue={defaults.type}
            disabled={pending}
            error={errors?.type}
          >
            {Object.values(ProductType).map((type) => (
              <option key={type} value={type}>
                {PRODUCT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>

          {mode === "edit" && (
            <Select
              id="active"
              name="active"
              label="Estado"
              defaultValue={defaults.active ? "true" : "false"}
              disabled={pending}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </Select>
          )}
        </div>

        {formError && <p className="text-sm text-error">{formError}</p>}

        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </form>
    </Card>
  );
}
