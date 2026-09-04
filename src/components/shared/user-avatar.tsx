import Image from "next/image";
import { getInitials, cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "size-9 text-sm",
  md: "size-16 text-lg",
  lg: "size-24 text-2xl",
} as const;

const SIZE_PX: Record<keyof typeof SIZE_CLASSES, number> = {
  sm: 36,
  md: 64,
  lg: 96,
};

// Single reusable avatar: renders the uploaded photo when `avatarUrl` is
// set, otherwise falls back to the user's initials. Used by the Header's
// user menu, the Sidebar footer, and the profile page, so all three stay
// visually in sync.
export function UserAvatar({
  name,
  avatarUrl,
  size = "sm",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={SIZE_PX[size]}
        height={SIZE_PX[size]}
        unoptimized
        className={cn(
          "shrink-0 rounded-full object-cover",
          SIZE_CLASSES[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
