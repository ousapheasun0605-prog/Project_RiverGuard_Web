/*
  Warnings:

  - You are about to drop the column `startedByUserId` on the `Mission` table. All the data in the column will be lost.
  - Added the required column `initiatedByUserId` to the `Mission` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `Mission` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Mission" DROP CONSTRAINT "Mission_startedByUserId_fkey";

-- AlterTable
ALTER TABLE "Mission" DROP COLUMN "startedByUserId",
ADD COLUMN     "initiatedByUserId" INTEGER NOT NULL,
ALTER COLUMN "name" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
