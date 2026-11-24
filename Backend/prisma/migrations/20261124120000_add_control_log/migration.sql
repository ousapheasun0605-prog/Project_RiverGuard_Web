-- CreateTable
CREATE TABLE "ControlLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "command" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ControlLog_createdAt_idx" ON "ControlLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ControlLog" ADD CONSTRAINT "ControlLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
