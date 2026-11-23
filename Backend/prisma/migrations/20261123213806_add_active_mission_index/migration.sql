CREATE UNIQUE INDEX "Mission_one_active_per_robot"
ON "Mission" ("robotId")
WHERE "status" = 'ACTIVE';
