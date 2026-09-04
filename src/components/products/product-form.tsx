"use client";

import { useActionState } from "react";
import { ProductType } from "@/generated/prisma/enums";
import type { ProductFormState } from "@/app/(app)/productos/actions";

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

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

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
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          defaultValue={defaults.name}
          disabled={pending}
          className={fieldClass(!!errors?.name)}
        />
        {errors?.name && <p className="text-sm text-error">{errors.name}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults.description}
          disabled={pending}
          className={fieldClass(false)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="officialPrice" className="text-sm font-medium text-foreground">
            Precio
          </label>
          <input
            id="officialPrice"
            name="officialPrice"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={defaults.officialPrice}
            disabled={pending}
            className={fieldClass(!!errors?.officialPrice)}
          />
          {errors?.officialPrice && <p className="text-sm text-error">{errors.officialPrice}</p>}
          {mode === "edit" && (
            <p className="text-xs text-muted-foreground">
              Solo afecta a nuevas ventas; las ventas ya registradas conservan su precio histórico.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="currency" className="text-sm font-medium text-foreground">
            Moneda
          </label>
          <input
            id="currency"
            name="currency"
            defaultValue={defaults.currency}
            disabled={pending}
            className={fieldClass(!!errors?.currency)}
          />
          {errors?.currency && <p className="text-sm text-error">{errors.currency}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="type" className="text-sm font-medium text-foreground">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            defaultValue={defaults.type}
            disabled={pending}
            className={fieldClass(!!errors?.type)}
          >
            {Object.values(ProductType).map((type) => (
              <option key={type} value={type}>
                {PRODUCT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          {errors?.type && <p className="text-sm text-error">{errors.type}</p>}
        </div>

        {mode === "edit" && (
          <div className="space-y-1">
            <label htmlFor="active" className="text-sm font-medium text-foreground">
              Estado
            </label>
            <select
              id="active"
              name="active"
              defaultValue={defaults.active ? "true" : "false"}
              disabled={pending}
              className={fieldClass(false)}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        )}
      </div>

      {formError && <p className="text-sm text-error">{formError}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
