ALTER TABLE "Invoice" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "cancelledByUserId" TEXT;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Invoice_cancelledByUserId_idx" ON "Invoice"("cancelledByUserId");
