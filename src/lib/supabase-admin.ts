import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client, used server-side only (never exposed to the
// browser) to read/write Storage buckets with full access, bypassing RLS --
// the same trust boundary as `prisma` in src/lib/prisma.ts. Not used for
// auth or the database itself, only for Storage (receipt uploads).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
