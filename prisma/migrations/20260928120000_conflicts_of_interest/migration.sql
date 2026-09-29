CREATE TABLE IF NOT EXISTS "ConflictOfInterest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "teamId" TEXT,
    "participantId" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "declaredById" TEXT NOT NULL,
    "overriddenById" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConflictOfInterest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ConflictOfInterest" ADD COLUMN IF NOT EXISTS "participantId" TEXT;
ALTER TABLE "ConflictOfInterest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
ALTER TABLE "ConflictOfInterest" ALTER COLUMN "teamId" DROP NOT NULL;
UPDATE "ConflictOfInterest" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "ConflictOfInterest" ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ConflictOfInterest_eventId_judgeId_teamId_key" ON "ConflictOfInterest"("eventId", "judgeId", "teamId");
CREATE UNIQUE INDEX IF NOT EXISTS "ConflictOfInterest_eventId_judgeId_participantId_key" ON "ConflictOfInterest"("eventId", "judgeId", "participantId");
CREATE INDEX IF NOT EXISTS "ConflictOfInterest_eventId_judgeId_active_idx" ON "ConflictOfInterest"("eventId", "judgeId", "active");
CREATE INDEX IF NOT EXISTS "ConflictOfInterest_eventId_teamId_active_idx" ON "ConflictOfInterest"("eventId", "teamId", "active");
CREATE INDEX IF NOT EXISTS "ConflictOfInterest_eventId_participantId_active_idx" ON "ConflictOfInterest"("eventId", "participantId", "active");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConflictOfInterest_one_target_check') THEN
        ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_one_target_check" CHECK (num_nonnulls("teamId", "participantId") = 1);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConflictOfInterest_eventId_fkey') THEN
        ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConflictOfInterest_judgeId_fkey') THEN
        ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConflictOfInterest_teamId_fkey') THEN
        ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConflictOfInterest_participantId_fkey') THEN
        ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConflictOfInterest_declaredById_fkey') THEN
        ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConflictOfInterest_overriddenById_fkey') THEN
        ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;