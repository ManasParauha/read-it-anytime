-- AlterTable
ALTER TABLE "Link" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "digestedAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Link_userId_status_idx" ON "Link"("userId", "status");

-- CreateIndex
CREATE INDEX "Link_userId_category_idx" ON "Link"("userId", "category");
