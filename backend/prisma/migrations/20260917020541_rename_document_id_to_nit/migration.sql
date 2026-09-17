ALTER TABLE "Client" RENAME COLUMN "documentId" TO "nit";
ALTER INDEX "Client_documentId_key" RENAME TO "Client_nit_key";
