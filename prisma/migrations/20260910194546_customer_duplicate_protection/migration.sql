-- DropIndex
-- Was a plain global UNIQUE on identification, which doesn't represent the
-- business rule (it blocks two unrelated customers from ever sharing a
-- cédula, and says nothing about customers without one). Replaced below by
-- two narrower, expression-based partial unique indexes.
DROP INDEX "Customer_identification_key";

-- Enable unaccent so "José"/"Jose" and "Pérez"/"Perez" compare equal.
-- Installed into the `extensions` schema (already on this database's
-- search_path), matching Supabase's convention of keeping extension
-- objects out of `public`. Safe to re-run: a no-op if already installed.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- unaccent(text) (the 1-arg form) is STABLE, not IMMUTABLE, because it
-- resolves its dictionary dynamically -- Postgres refuses to use a STABLE
-- function inside an index expression ("functions in index expression must
-- be marked IMMUTABLE"). The 2-arg form, given an explicit, schema-qualified
-- dictionary name instead of resolving one implicitly, has no such
-- run-time dependency, so wrapping it like this is the documented, safe way
-- to make it indexable. Schema-qualifying both the function and the
-- dictionary name means this has no dependency on the caller's search_path.
CREATE OR REPLACE FUNCTION public.customer_immutable_unaccent(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT extensions.unaccent('extensions.unaccent'::regdictionary, input)
$$;

-- Canonical name comparison: strip diacritics, trim, collapse internal
-- whitespace, lowercase. Mirrored exactly (expression for expression) by
-- normalizeCustomerName() in src/lib/customer-normalize.ts -- keep both in
-- sync if this ever changes. Never applied to the stored fullName itself,
-- only used inside index expressions and duplicate-lookup queries.
CREATE OR REPLACE FUNCTION public.customer_normalize_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT lower(regexp_replace(trim(both from public.customer_immutable_unaccent(input)), '\s+', ' ', 'g'))
$$;

-- Canonical identification comparison: strip separators, uppercase.
-- Mirrored by normalizeCustomerIdentification() in
-- src/lib/customer-normalize.ts.
CREATE OR REPLACE FUNCTION public.customer_normalize_identification(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT upper(regexp_replace(input, '[^A-Za-z0-9]', '', 'g'))
$$;

-- Canonical Ecuadorian phone comparison. Strips everything but digits,
-- drops a leading "00" international-call prefix, and rewrites a local
-- trunk-prefixed number (0 + 9-digit mobile, or 0 + 1-digit area code +
-- 7-digit line = 9 or 10 digits) to country-code form, so
-- "0999999999" / "593999999999" / "+593999999999" / "+593 99 999 9999" /
-- "593-99-999-9999" all converge on "593999999999". A number that doesn't
-- match a recognized Ecuadorian pattern (foreign numbers, malformed
-- input) is left as plain digits rather than guessed at. Mirrored by
-- normalizeCustomerPhone() in src/lib/customer-normalize.ts.
CREATE OR REPLACE FUNCTION public.customer_normalize_ec_phone(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT CASE
    WHEN length(d) IN (9, 10) AND left(d, 1) = '0' THEN '593' || substring(d from 2)
    ELSE d
  END
  FROM (SELECT regexp_replace(regexp_replace(input, '[^0-9]', '', 'g'), '^00', '') AS d) AS s
$$;

-- A) Primary duplicate rule when a cédula/RUC is on file: same normalized
-- name + same normalized identification. Customers with no identification
-- (NULL) never participate -- regexp/normalize of NULL is NULL, and NULL
-- is never considered equal to anything, including another NULL, by a
-- unique index -- but the WHERE clause makes that explicit rather than
-- relying on that behavior.
CREATE UNIQUE INDEX customer_name_identification_unique
  ON "Customer" (
    public.customer_normalize_name("fullName"),
    public.customer_normalize_identification(identification)
  )
  WHERE identification IS NOT NULL;

-- B) Primary duplicate rule when there's no cédula/RUC on file: same
-- normalized name + same normalized (Ecuador-aware) phone, scoped to
-- OTHER customers that also have no cédula/RUC on file (identification
-- IS NULL on both sides). The cross case (one customer with a cédula,
-- another without, but matching name+phone) is an allowed combination,
-- not a duplicate -- findCustomerByNameAndPhone() in
-- customer-repository.ts mirrors this same scoping in its application-
-- level pre-check, so the two layers agree.
CREATE UNIQUE INDEX customer_name_phone_unique
  ON "Customer" (
    public.customer_normalize_name("fullName"),
    public.customer_normalize_ec_phone(phone)
  )
  WHERE identification IS NULL;
