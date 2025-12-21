-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('FINISHED', 'SEMI_CA', 'SEMI_MC');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CONSUMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('CRIMP', 'CIRCUIT', 'VISUAL');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "BOMItemType" AS ENUM ('MATERIAL', 'PRODUCT');

-- CreateEnum
CREATE TYPE "BundleStatus" AS ENUM ('CREATED', 'SHIPPED', 'UNBUNDLED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "spec" VARCHAR(200),
    "type" "ProductType" NOT NULL DEFAULT 'FINISHED',
    "process_code" VARCHAR(10),
    "crimp_code" VARCHAR(50),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "spec" VARCHAR(200),
    "category" VARCHAR(50) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "safe_stock" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_stocks" (
    "id" SERIAL NOT NULL,
    "material_id" INTEGER NOT NULL,
    "lot_number" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "used_qty" INTEGER NOT NULL DEFAULT 0,
    "location" VARCHAR(50),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_lots" (
    "id" SERIAL NOT NULL,
    "lot_number" VARCHAR(100) NOT NULL,
    "process_code" VARCHAR(10) NOT NULL,
    "product_id" INTEGER,
    "line_code" VARCHAR(20),
    "planned_qty" INTEGER NOT NULL DEFAULT 0,
    "completed_qty" INTEGER NOT NULL DEFAULT 0,
    "defect_qty" INTEGER NOT NULL DEFAULT 0,
    "carry_over_in" INTEGER NOT NULL DEFAULT 0,
    "carry_over_out" INTEGER NOT NULL DEFAULT 0,
    "status" "LotStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "barcode_version" INTEGER NOT NULL DEFAULT 2,
    "worker_id" INTEGER,
    "parent_lot_id" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_materials" (
    "id" SERIAL NOT NULL,
    "production_lot_id" INTEGER NOT NULL,
    "material_id" INTEGER NOT NULL,
    "material_lot_no" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" SERIAL NOT NULL,
    "production_lot_id" INTEGER NOT NULL,
    "type" "InspectionType" NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "defect_reason" VARCHAR(200),
    "defect_qty" INTEGER NOT NULL DEFAULT 0,
    "inspector_id" INTEGER,
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_counters" (
    "id" SERIAL NOT NULL,
    "prefix" VARCHAR(20) NOT NULL,
    "date_key" VARCHAR(10) NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequence_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boms" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "item_type" "BOMItemType" NOT NULL,
    "material_id" INTEGER,
    "child_product_id" INTEGER,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" VARCHAR(20),
    "process_code" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lines" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "process_code" VARCHAR(10) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carry_overs" (
    "id" SERIAL NOT NULL,
    "process_code" VARCHAR(10) NOT NULL,
    "product_id" INTEGER NOT NULL,
    "line_code" VARCHAR(20) NOT NULL,
    "source_date" DATE NOT NULL,
    "source_lot_no" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "used_qty" INTEGER NOT NULL DEFAULT 0,
    "target_lot_no" VARCHAR(100),
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carry_overs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_lots" (
    "id" SERIAL NOT NULL,
    "bundle_no" VARCHAR(100) NOT NULL,
    "product_id" INTEGER NOT NULL,
    "set_quantity" INTEGER NOT NULL DEFAULT 0,
    "total_qty" INTEGER NOT NULL DEFAULT 0,
    "status" "BundleStatus" NOT NULL DEFAULT 'CREATED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundle_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" SERIAL NOT NULL,
    "bundle_lot_id" INTEGER NOT NULL,
    "production_lot_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_user_settings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "table_name" VARCHAR(100) NOT NULL,
    "settings" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_code_idx" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_type_idx" ON "products"("type");

-- CreateIndex
CREATE UNIQUE INDEX "materials_code_key" ON "materials"("code");

-- CreateIndex
CREATE INDEX "materials_code_idx" ON "materials"("code");

-- CreateIndex
CREATE INDEX "materials_category_idx" ON "materials"("category");

-- CreateIndex
CREATE INDEX "material_stocks_material_id_idx" ON "material_stocks"("material_id");

-- CreateIndex
CREATE INDEX "material_stocks_lot_number_idx" ON "material_stocks"("lot_number");

-- CreateIndex
CREATE UNIQUE INDEX "production_lots_lot_number_key" ON "production_lots"("lot_number");

-- CreateIndex
CREATE INDEX "production_lots_lot_number_idx" ON "production_lots"("lot_number");

-- CreateIndex
CREATE INDEX "production_lots_process_code_idx" ON "production_lots"("process_code");

-- CreateIndex
CREATE INDEX "production_lots_status_idx" ON "production_lots"("status");

-- CreateIndex
CREATE INDEX "production_lots_product_id_idx" ON "production_lots"("product_id");

-- CreateIndex
CREATE INDEX "production_lots_started_at_idx" ON "production_lots"("started_at");

-- CreateIndex
CREATE INDEX "lot_materials_production_lot_id_idx" ON "lot_materials"("production_lot_id");

-- CreateIndex
CREATE INDEX "lot_materials_material_id_idx" ON "lot_materials"("material_id");

-- CreateIndex
CREATE INDEX "lot_materials_material_lot_no_idx" ON "lot_materials"("material_lot_no");

-- CreateIndex
CREATE INDEX "inspections_production_lot_id_idx" ON "inspections"("production_lot_id");

-- CreateIndex
CREATE INDEX "inspections_type_idx" ON "inspections"("type");

-- CreateIndex
CREATE INDEX "inspections_result_idx" ON "inspections"("result");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_counters_prefix_date_key_key" ON "sequence_counters"("prefix", "date_key");

-- CreateIndex
CREATE INDEX "boms_product_id_idx" ON "boms"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "lines_code_key" ON "lines"("code");

-- CreateIndex
CREATE INDEX "lines_process_code_idx" ON "lines"("process_code");

-- CreateIndex
CREATE INDEX "carry_overs_process_code_product_id_idx" ON "carry_overs"("process_code", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_lots_bundle_no_key" ON "bundle_lots"("bundle_no");

-- CreateIndex
CREATE INDEX "bundle_items_bundle_lot_id_idx" ON "bundle_items"("bundle_lot_id");

-- CreateIndex
CREATE INDEX "bundle_items_production_lot_id_idx" ON "bundle_items"("production_lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "table_user_settings_user_id_table_name_key" ON "table_user_settings"("user_id", "table_name");

-- AddForeignKey
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lots" ADD CONSTRAINT "production_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lots" ADD CONSTRAINT "production_lots_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lots" ADD CONSTRAINT "production_lots_parent_lot_id_fkey" FOREIGN KEY ("parent_lot_id") REFERENCES "production_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_materials" ADD CONSTRAINT "lot_materials_production_lot_id_fkey" FOREIGN KEY ("production_lot_id") REFERENCES "production_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_materials" ADD CONSTRAINT "lot_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_production_lot_id_fkey" FOREIGN KEY ("production_lot_id") REFERENCES "production_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_child_product_id_fkey" FOREIGN KEY ("child_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carry_overs" ADD CONSTRAINT "carry_overs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_lots" ADD CONSTRAINT "bundle_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_lot_id_fkey" FOREIGN KEY ("bundle_lot_id") REFERENCES "bundle_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_production_lot_id_fkey" FOREIGN KEY ("production_lot_id") REFERENCES "production_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_user_settings" ADD CONSTRAINT "table_user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
