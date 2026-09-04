-- AlterTable
-- Enforce a unique product catalog: each Product.name must be distinct.
-- Verified before creating this migration that no duplicate names exist
-- in the current data (see chat/session notes), so this cannot fail.
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");
