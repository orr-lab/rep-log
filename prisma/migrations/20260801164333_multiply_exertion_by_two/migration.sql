-- Perceived exertion moves from a 1-5 scale to 1-10. Existing logged entries are rescaled by
-- doubling, so a set that was a "3/5" reads as "6/10" -- proportionally the same effort, not
-- reset to the bottom of the new range. This is a one-time data fix; the app-level range check
-- (src/lib/validation.ts) enforces 1-10 for every entry logged from here on.
UPDATE "WorkoutEntry" SET "difficulty" = "difficulty" * 2;
