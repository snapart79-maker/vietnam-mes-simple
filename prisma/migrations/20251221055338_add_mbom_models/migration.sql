-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductType" ADD VALUE 'SEMI_MS';
ALTER TYPE "ProductType" ADD VALUE 'SEMI_SB';
ALTER TYPE "ProductType" ADD VALUE 'SEMI_HS';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "bundle_qty" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "circuit_no" INTEGER,
ADD COLUMN     "parent_code" VARCHAR(50);

-- CreateTable
CREATE TABLE "processes" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "seq" INTEGER NOT NULL,
    "has_material_input" BOOLEAN NOT NULL DEFAULT false,
    "is_inspection" BOOLEAN NOT NULL DEFAULT false,
    "short_code" VARCHAR(2),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_routings" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "process_code" VARCHAR(10) NOT NULL,
    "seq" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_routings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processes_code_key" ON "processes"("code");

-- CreateIndex
CREATE INDEX "processes_code_idx" ON "processes"("code");

-- CreateIndex
CREATE INDEX "processes_seq_idx" ON "processes"("seq");

-- CreateIndex
CREATE INDEX "process_routings_product_id_idx" ON "process_routings"("product_id");

-- CreateIndex
CREATE INDEX "process_routings_process_code_idx" ON "process_routings"("process_code");

-- CreateIndex
CREATE UNIQUE INDEX "process_routings_product_id_process_code_key" ON "process_routings"("product_id", "process_code");

-- CreateIndex
CREATE INDEX "products_parent_code_idx" ON "products"("parent_code");

-- AddForeignKey
ALTER TABLE "process_routings" ADD CONSTRAINT "process_routings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_routings" ADD CONSTRAINT "process_routings_process_code_fkey" FOREIGN KEY ("process_code") REFERENCES "processes"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
