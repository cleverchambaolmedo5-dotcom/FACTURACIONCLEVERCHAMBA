import "server-only";
import { isValidEmail } from "@/lib/validation";
import type { PublicUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import * as userRepository from "@/server/repositories/user-repository";
import {
  MAX_AVATAR_BYTES,
  deletePreviousAvatar,
  saveAvatarFile,
  validateAvatarFile,
} from "./avatar-storage";

// All profile self-service logic lives here, not in pages/components/
// actions. Every function takes the authenticated `user` (from
// getCurrentUser(), never a client-supplied id) and only ever reads or
// writes that same user's row -- there is no "target user id" input
// anywhere in this module, by design.

// ---------------------------------------------------------------------
// Profile fields (name, email, phone, country, city, avatar)
// ---------------------------------------------------------------------

export type ProfileFieldErrors = Partial<
  Record<"name" | "email" | "phone" | "country" | "city" | "avatar", string>
>;

export type ProfileActionResult =
  | { ok: true; profile: userRepository.UserProfile }
  | { ok: false; errors?: ProfileFieldErrors; formError?: string };

export type RawProfileInput = {
  name?: FormDataEntryValue | null;
  email?: FormDataEntryValue | null;
  phone?: FormDataEntryValue | null;
  country?: FormDataEntryValue | null;
  city?: FormDataEntryValue | null;
  avatar?: FormDataEntryValue | null;
};

function str(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUniqueEmailError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export function getProfileForUser(user: PublicUser) {
  return userRepository.findProfileById(user.id);
}

export async function updateProfileForUser(
  user: PublicUser,
  raw: RawProfileInput,
): Promise<ProfileActionResult> {
  const name = str(raw.name);
  const email = str(raw.email).toLowerCase();
  const phone = str(raw.phone);
  const country = str(raw.country);
  const city = str(raw.city);

  const errors: ProfileFieldErrors = {};
  if (!name) errors.name = "El nombre es obligatorio.";
  if (!email || !isValidEmail(email)) {
    errors.email = "El correo no tiene un formato válido.";
  }

  if (!errors.email) {
    const existing = await userRepository.findUserByEmail(email);
    if (existing && existing.id !== user.id) {
      errors.email = "Ese correo ya está en uso.";
    }
  }

  // An empty file input still arrives as a zero-byte File with an empty
  // name -- treat that as "no new avatar" rather than a validation error.
  const avatarFile =
    raw.avatar instanceof File && raw.avatar.size > 0 ? raw.avatar : null;

  if (avatarFile) {
    const validationError = validateAvatarFile(avatarFile);
    if (validationError === "type") {
      errors.avatar = "Solo se permiten imágenes JPG, JPEG, PNG o WEBP.";
    } else if (validationError === "size") {
      errors.avatar = `La imagen no debe superar ${Math.floor(MAX_AVATAR_BYTES / (1024 * 1024))} MB.`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  try {
    const newAvatarUrl = avatarFile ? await saveAvatarFile(user.id, avatarFile) : undefined;

    const updated = await userRepository.updateProfile(user.id, {
      name,
      email,
      phone: phone || null,
      country: country || null,
      city: city || null,
      ...(newAvatarUrl ? { avatarUrl: newAvatarUrl } : {}),
    });

    if (newAvatarUrl) {
      // Best-effort cleanup, after the DB already points at the new file.
      // A failure here must never undo or fail the profile update.
      await deletePreviousAvatar(user.avatarUrl);
    }

    return { ok: true, profile: updated };
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return { ok: false, errors: { email: "Ese correo ya está en uso." } };
    }
    console.error("[profile] Failed to update profile:", error);
    return {
      ok: false,
      formError: "No se pudo actualizar el perfil. Intenta nuevamente.",
    };
  }
}

// ---------------------------------------------------------------------
// Password change
// ---------------------------------------------------------------------

export type PasswordFieldErrors = Partial<
  Record<"currentPassword" | "newPassword" | "confirmPassword", string>
>;

export type PasswordActionResult =
  | { ok: true }
  | { ok: false; errors?: PasswordFieldErrors; formError?: string };

export type RawPasswordInput = {
  currentPassword?: FormDataEntryValue | null;
  newPassword?: FormDataEntryValue | null;
  confirmPassword?: FormDataEntryValue | null;
};

// Deliberately not trimmed: a password's leading/trailing whitespace may
// be intentional, unlike a name or email.
function passwordStr(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value : "";
}

export async function changePasswordForUser(
  user: PublicUser,
  raw: RawPasswordInput,
): Promise<PasswordActionResult> {
  const currentPassword = passwordStr(raw.currentPassword);
  const newPassword = passwordStr(raw.newPassword);
  const confirmPassword = passwordStr(raw.confirmPassword);

  const errors: PasswordFieldErrors = {};
  if (!currentPassword) {
    errors.currentPassword = "Ingresa tu contraseña actual.";
  }
  if (!newPassword || newPassword.length < 8) {
    errors.newPassword = "La nueva contraseña debe tener al menos 8 caracteres.";
  }
  if (!confirmPassword || confirmPassword !== newPassword) {
    errors.confirmPassword = "Las contraseñas no coinciden.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const record = await userRepository.findUserWithPasswordById(user.id);
  if (!record) {
    // Should be unreachable (the user is authenticated), but never trust it.
    return { ok: false, formError: "No se pudo verificar tu cuenta." };
  }

  const currentMatches = await verifyPassword(currentPassword, record.passwordHash);
  if (!currentMatches) {
    return {
      ok: false,
      errors: { currentPassword: "La contraseña actual no es correcta." },
    };
  }

  if (newPassword === currentPassword) {
    return {
      ok: false,
      errors: {
        newPassword: "La nueva contraseña debe ser diferente de la actual.",
      },
    };
  }

  const passwordHash = await hashPassword(newPassword);
  await userRepository.updatePasswordHash(user.id, passwordHash);

  return { ok: true };
}
