-- CreateEnum
CREATE TYPE "BundleType" AS ENUM ('SAME_PRODUCT', 'MULTI_PRODUCT');

-- AlterTable
ALTER TABLE "bundle_lots" ADD COLUMN     "bundle_type" "BundleType" NOT NULL DEFAULT 'SAME_PRODUCT';
