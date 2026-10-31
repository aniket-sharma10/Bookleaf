-- AlterTable
-- The pattern-based draft post-check was removed (ADR-0010).
ALTER TABLE "AiDraft" DROP COLUMN "warnings";
