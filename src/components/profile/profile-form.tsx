"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { ProfileFormState } from "@/app/(app)/perfil/actions";
import type { UserProfile } from "@/server/repositories/user-repository";

export type ProfileFormAction = (
  state: ProfileFormState,
  formData: FormData,
) => Promise<ProfileFormState>;

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

export function ProfileForm({
  action,
  profile,
}: {
  action: ProfileFormAction;
  profile: UserProfile;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    action,
    undefined,
  );
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;
  const succeeded = state?.ok === true;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The server already re-rendered this page with the fresh profile (via
  // revalidatePath), so once a save succeeds the local preview is no
  // longer needed -- `profile.avatarUrl` now reflects it. Adjusting state
  // during render (rather than in an effect) on a `succeeded` transition
  // is the pattern React recommends for resetting state after an action:
  // https://react.dev/learn/you-might-not-need-an-effect
  const [wasSucceeded, setWasSucceeded] = useState(false);
  if (succeeded !== wasSucceeded) {
    setWasSucceeded(succeeded);
    if (succeeded) {
      setPreviewUrl(null);
    }
  }

  // Imperative DOM sync only (no React state) -- safe in an effect.
  useEffect(() => {
    if (succeeded && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [succeeded]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  const displayAvatarUrl = previewUrl ?? profile.avatarUrl;

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="max-w-xl space-y-6 rounded-lg border border-border bg-surface p-6"
      noValidate
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">Mi perfil</h3>
        <p className="text-xs text-muted-foreground">
          Esta información es visible para ti y para los administradores.
        </p>
      </div>

      <div className="flex items-center gap-4">
        {previewUrl ? (
          // Local preview of the not-yet-saved file -- plain <img> since
          // it's a blob: URL, which next/image can't optimize anyway.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={profile.name}
            className="size-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <UserAvatar name={profile.name} avatarUrl={displayAvatarUrl} size="md" />
        )}
        <div className="space-y-1">
          <label
            htmlFor="avatar"
            className="inline-block cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-black/5"
          >
            Cambiar foto
          </label>
          <input
            ref={fileInputRef}
            id="avatar"
            name="avatar"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            disabled={pending}
            onChange={handleAvatarChange}
            className="sr-only"
          />
          <p className="text-xs text-muted-foreground">JPG, PNG o WEBP. Máximo 5 MB.</p>
          {errors?.avatar && <p className="text-sm text-error">{errors.avatar}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          defaultValue={profile.name}
          disabled={pending}
          className={fieldClass(!!errors?.name)}
        />
        {errors?.name && <p className="text-sm text-error">{errors.name}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={profile.email}
          disabled={pending}
          className={fieldClass(!!errors?.email)}
        />
        {errors?.email && <p className="text-sm text-error">{errors.email}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="phone" className="text-sm font-medium text-foreground">
            Teléfono <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={profile.phone ?? ""}
            disabled={pending}
            className={fieldClass(!!errors?.phone)}
          />
          {errors?.phone && <p className="text-sm text-error">{errors.phone}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="country" className="text-sm font-medium text-foreground">
            País <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="country"
            name="country"
            defaultValue={profile.country ?? ""}
            disabled={pending}
            className={fieldClass(!!errors?.country)}
          />
          {errors?.country && <p className="text-sm text-error">{errors.country}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="city" className="text-sm font-medium text-foreground">
          Ciudad <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="city"
          name="city"
          defaultValue={profile.city ?? ""}
          disabled={pending}
          className={fieldClass(!!errors?.city)}
        />
        {errors?.city && <p className="text-sm text-error">{errors.city}</p>}
      </div>

      {formError && <p className="text-sm text-error">{formError}</p>}
      {succeeded && <p className="text-sm text-success">Perfil actualizado correctamente.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
