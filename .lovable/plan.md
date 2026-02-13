

## Scheduler Simulation Tests

Create a comprehensive test suite that runs the round-robin scheduler with various player counts (4-16) on 2 courts, then validates fairness, conflict-freedom, rest distribution, and randomness.

### Test File
**`src/lib/scheduler.test.ts`**

### Test Setup
- Install vitest/testing dependencies (already available)
- Create `vitest.config.ts` and `src/test/setup.ts` if missing
- Import `generateSchedule` from `scheduler.ts`

### Test Cases

**1. No Player Conflicts (Critical)**
For each player count (4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16):
- Generate schedule with 2 courts, doubles, 10-min games, 200-min total
- For every time slot, verify no player appears in more than one match
- Also check that no player appears twice within the same match

**2. Fairness of Play (Same Number of Rounds)**
For each player count:
- Count total matches per player across the full schedule
- Assert that max - min match count is at most 2 (allowing minor variance due to odd player counts)
- Report the distribution for visibility

**3. Rest Distribution (No Excessive Consecutive Play or Wait)**
For each player count:
- Track consecutive matches per player (max streak without a gap)
- Assert max consecutive is at most 3
- Track max gap between matches (slots waiting)
- Assert max gap is reasonable relative to player/court ratio

**4. Group Diversity / Randomness**
For each player count >= 8:
- Track how often the same 4-player group repeats
- Assert no group repeats more than twice in a row
- Run the scheduler 3 times and verify schedules are not identical (randomness check)

**5. Edge Cases**
- Exactly 4 players, 2 courts (only 1 court should be used)
- 5 players, 2 courts (1 player always resting)
- Large count (16 players, 2 courts)

### Technical Details

```typescript
// Test structure example
import { describe, it, expect } from "vitest";
import { generateSchedule } from "./scheduler";

describe("Round Robin Scheduler", () => {
  const COURTS = 2;
  const GAME_DURATION = 10;
  const TOTAL_TIME = 200;

  for (const playerCount of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16]) {
    describe(`${playerCount} players`, () => {
      const players = Array.from({ length: playerCount }, (_, i) => `P${i + 1}`);
      const matches = generateSchedule(players, GAME_DURATION, TOTAL_TIME, COURTS);

      it("no player appears in two matches at the same time slot", () => {
        // Group matches by startTime, check for duplicate players
      });

      it("fair play distribution (max-min match count <= 2)", () => {
        // Count matches per player, check variance
      });

      it("no player plays more than 3 consecutive matches", () => {
        // Track consecutive slots per player
      });

      it("no player waits more than a reasonable number of slots", () => {
        // Track gaps, assert max gap <= ceil(playerCount / (COURTS * 4)) + 2
      });
    });
  }

  it("produces different schedules on repeated generation (randomness)", () => {
    // Generate 3 schedules, verify not all identical
  });
});
```

### Files to Create/Modify
1. **Create** `vitest.config.ts` - Vitest configuration
2. **Create** `src/test/setup.ts` - Test setup with matchMedia mock
3. **Create** `src/lib/scheduler.test.ts` - The main test suite
4. **Modify** `tsconfig.app.json` - Add `"vitest/globals"` to types

### Running
Tests will be executed via the run-tests tool after implementation.

