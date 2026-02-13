import { describe, it, expect } from "vitest";
import { generateSchedule, regenerateScheduleFromSlot, Match } from "./scheduler";

// Helper: group matches by time slot
function groupBySlot(matches: Match[]): Map<number, Match[]> {
  const slots = new Map<number, Match[]>();
  for (const m of matches) {
    const slot = m.startTime;
    if (!slots.has(slot)) slots.set(slot, []);
    slots.get(slot)!.push(m);
  }
  return slots;
}

// Helper: get all players in a match
function matchPlayers(m: Match): string[] {
  return [...m.team1, ...m.team2];
}

// Helper: count matches per player
function matchCountPerPlayer(matches: Match[], players: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  players.forEach(p => counts.set(p, 0));
  for (const m of matches) {
    for (const p of matchPlayers(m)) {
      counts.set(p, (counts.get(p) || 0) + 1);
    }
  }
  return counts;
}

// Helper: get sorted slot indices for a player
function playerSlots(matches: Match[], player: string): number[] {
  const slots: number[] = [];
  for (const m of matches) {
    if (matchPlayers(m).includes(player)) {
      slots.push(m.startTime);
    }
  }
  return [...new Set(slots)].sort((a, b) => a - b);
}

describe("Round Robin Scheduler", () => {
  const COURTS = 2;
  const GAME_DURATION = 10;
  const TOTAL_TIME = 200;

  for (const playerCount of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
    describe(`${playerCount} players`, () => {
      const players = Array.from({ length: playerCount }, (_, i) => `P${i + 1}`);
      // Generate once per player count for deterministic tests
      let matches: Match[];

      // Use beforeAll-like pattern: generate in first test, reuse
      function getMatches() {
        if (!matches) {
          matches = generateSchedule(players, GAME_DURATION, TOTAL_TIME, COURTS);
        }
        return matches;
      }

      it("generates matches", () => {
        const m = getMatches();
        expect(m.length).toBeGreaterThan(0);
        console.log(`  ${playerCount} players → ${m.length} matches generated`);
      });

      it("no player appears in two matches at the same time slot", () => {
        const m = getMatches();
        const slots = groupBySlot(m);

        for (const [slot, slotMatches] of slots) {
          const allPlayers: string[] = [];
          for (const match of slotMatches) {
            const ps = matchPlayers(match);
            allPlayers.push(...ps);
          }
          const unique = new Set(allPlayers);
          expect(unique.size).toBe(allPlayers.length);
        }
      });

      it("no player appears twice within the same match", () => {
        const m = getMatches();
        for (const match of m) {
          const ps = matchPlayers(match);
          const unique = new Set(ps);
          expect(unique.size).toBe(ps.length);
        }
      });

      it("fair play distribution (max-min match count <= 2)", () => {
        const m = getMatches();
        const counts = matchCountPerPlayer(m, players);
        const values = [...counts.values()];
        const max = Math.max(...values);
        const min = Math.min(...values);
        const diff = max - min;

        console.log(`  ${playerCount}p fairness: min=${min} max=${max} diff=${diff} | ${[...counts.entries()].map(([p, c]) => `${p}:${c}`).join(" ")}`);

        expect(diff).toBeLessThanOrEqual(2);
      });

      it("no player plays more than 3 consecutive matches", () => {
        const m = getMatches();

        // When playerCount <= courts * playersPerMatch, everyone plays every slot - skip this test
        const playersPerSlot = COURTS * 4;
        if (playerCount <= playersPerSlot) return;

        // Use actual slot numbers (startTime / GAME_DURATION) not compressed indices
        for (const player of players) {
          const actualSlots = [...new Set(
            m.filter(match => matchPlayers(match).includes(player))
              .map(match => match.startTime / GAME_DURATION)
          )].sort((a, b) => a - b);
          
          let maxConsecutive = 1;
          let current = 1;
          for (let i = 1; i < actualSlots.length; i++) {
            if (actualSlots[i] === actualSlots[i - 1] + 1) {
              current++;
              maxConsecutive = Math.max(maxConsecutive, current);
            } else {
              current = 1;
            }
          }

          if (maxConsecutive > 3) {
            console.log(`  WARNING: ${player} played ${maxConsecutive} consecutive slots (actual slots: ${actualSlots.slice(0, 20).join(',')})`);
          }
          expect(maxConsecutive).toBeLessThanOrEqual(3);
        }
      });

      it("no player waits more than a reasonable number of slots", () => {
        const m = getMatches();
        const allSlotTimes = [...new Set(m.map(x => x.startTime))].sort((a, b) => a - b);
        const slotIndex = new Map<number, number>();
        allSlotTimes.forEach((t, i) => slotIndex.set(t, i));

        // Reasonable max gap: based on ratio of waiting players to active players
        const playersPerSlot = COURTS * 4; // doubles
        const maxReasonableGap = Math.ceil(playerCount / playersPerSlot) + 2;

        for (const player of players) {
          const pSlots = playerSlots(m, player).map(t => slotIndex.get(t)!);
          
          let maxGap = 0;
          for (let i = 1; i < pSlots.length; i++) {
            const gap = pSlots[i] - pSlots[i - 1] - 1; // slots between matches
            maxGap = Math.max(maxGap, gap);
          }

          if (maxGap > maxReasonableGap) {
            console.log(`  WARNING: ${player} waited ${maxGap} slots (max reasonable: ${maxReasonableGap})`);
          }
          expect(maxGap).toBeLessThanOrEqual(maxReasonableGap);
        }
      });

      if (playerCount >= 8) {
        it("no 4-player group repeats more than twice consecutively", () => {
          const m = getMatches();
          const sortedMatches = [...m].sort((a, b) => a.startTime - b.startTime || a.court - b.court);

          const groupHistory: string[] = [];
          for (const match of sortedMatches) {
            const group = matchPlayers(match).sort().join("-");
            groupHistory.push(group);
          }

          // Check for 3+ consecutive same groups
          for (let i = 2; i < groupHistory.length; i++) {
            if (groupHistory[i] === groupHistory[i - 1] && groupHistory[i] === groupHistory[i - 2]) {
              console.log(`  WARNING: Group ${groupHistory[i]} repeated 3 times at indices ${i - 2},${i - 1},${i}`);
              expect(true).toBe(false); // fail
            }
          }
        });
      }
    });
  }

  describe("Randomness", () => {
    it("produces different schedules on repeated generation", () => {
      const players = Array.from({ length: 10 }, (_, i) => `P${i + 1}`);
      const schedules = Array.from({ length: 3 }, () =>
        generateSchedule(players, GAME_DURATION, TOTAL_TIME, COURTS)
      );

      // Serialize and compare
      const serialized = schedules.map(s =>
        s.map(m => `${m.startTime}-${m.court}-${matchPlayers(m).sort().join(",")}`).join("|")
      );

      const allIdentical = serialized.every(s => s === serialized[0]);
      if (allIdentical) {
        console.log("  WARNING: All 3 schedules are identical - no randomness");
      }
      expect(allIdentical).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("4 players, 2 courts - at most 1 court used per slot", () => {
      const players = ["A", "B", "C", "D"];
      const m = generateSchedule(players, GAME_DURATION, TOTAL_TIME, COURTS);
      const slots = groupBySlot(m);

      for (const [slot, slotMatches] of slots) {
        expect(slotMatches.length).toBeLessThanOrEqual(1);
      }
    });

    it("5 players, 2 courts - exactly 1 player resting per slot", () => {
      const players = ["A", "B", "C", "D", "E"];
      const m = generateSchedule(players, GAME_DURATION, TOTAL_TIME, COURTS);
      const slots = groupBySlot(m);

      for (const [slot, slotMatches] of slots) {
        const activePlayers = new Set<string>();
        for (const match of slotMatches) {
          matchPlayers(match).forEach(p => activePlayers.add(p));
        }
        expect(activePlayers.size).toBeLessThanOrEqual(4);
        expect(slotMatches.length).toBeLessThanOrEqual(1);
      }
    });

    it("16 players, 2 courts - handles large count without conflicts", () => {
      const players = Array.from({ length: 16 }, (_, i) => `P${i + 1}`);
      const m = generateSchedule(players, GAME_DURATION, TOTAL_TIME, COURTS);
      const slots = groupBySlot(m);

      expect(m.length).toBeGreaterThan(0);
      for (const [slot, slotMatches] of slots) {
        const allPlayers: string[] = [];
        for (const match of slotMatches) {
          allPlayers.push(...matchPlayers(match));
        }
        const unique = new Set(allPlayers);
        expect(unique.size).toBe(allPlayers.length);
      }
    });
  });

  // ==================== DYNAMIC PLAYER CHANGES ====================

  describe("Dynamic Player Changes", () => {
    // Helper: simulate playing K slots then regenerating with new players
    function simulateMidGameChange(
      initialPlayerCount: number,
      slotsPlayed: number,
      removePlayers: number[],  // indices to remove
      addPlayers: string[],     // new player names to add
    ) {
      const initialPlayers = Array.from({ length: initialPlayerCount }, (_, i) => `P${i + 1}`);
      const initialMatches = generateSchedule(initialPlayers, GAME_DURATION, TOTAL_TIME, COURTS);

      const cutoffTime = slotsPlayed * GAME_DURATION;
      const playedMatches = initialMatches.filter(m => m.startTime < cutoffTime);

      // Build new player list
      const newPlayers = initialPlayers.filter((_, i) => !removePlayers.includes(i));
      newPlayers.push(...addPlayers);

      const regenerated = regenerateScheduleFromSlot(
        newPlayers,
        playedMatches,
        cutoffTime,
        GAME_DURATION,
        TOTAL_TIME,
        COURTS,
      );

      // regenerated includes played + new matches
      const newMatchesOnly = regenerated.filter(m => m.startTime >= cutoffTime);

      return { playedMatches, newMatchesOnly, allMatches: regenerated, newPlayers, initialPlayers };
    }

    // Shared validation functions for dynamic tests
    function validateNoConflicts(matches: Match[], label: string) {
      const slots = groupBySlot(matches);
      for (const [slot, slotMatches] of slots) {
        const allPs: string[] = [];
        for (const match of slotMatches) {
          allPs.push(...matchPlayers(match));
        }
        const unique = new Set(allPs);
        expect(unique.size, `Conflict in ${label} at slot ${slot}`).toBe(allPs.length);
      }
    }

    function validateNoDuplicatesInMatch(matches: Match[], label: string) {
      for (const match of matches) {
        const ps = matchPlayers(match);
        const unique = new Set(ps);
        expect(unique.size, `Duplicate in match ${match.id} (${label})`).toBe(ps.length);
      }
    }

    function validateFairness(matches: Match[], players: string[], label: string, maxDiff = 3) {
      const counts = matchCountPerPlayer(matches, players);
      const values = [...counts.values()].filter(v => v > 0); // only players who actually played
      if (values.length < 2) return;
      const max = Math.max(...values);
      const min = Math.min(...values);
      const diff = max - min;
      console.log(`  ${label} fairness: min=${min} max=${max} diff=${diff} | ${[...counts.entries()].filter(([,c]) => c > 0).map(([p, c]) => `${p}:${c}`).join(" ")}`);
      expect(diff, `Fairness violation in ${label}`).toBeLessThanOrEqual(maxDiff);
    }

    function validateConsecutivePlay(matches: Match[], players: string[], label: string) {
      const playersPerSlot = COURTS * 4;
      if (players.length <= playersPerSlot) return;

      for (const player of players) {
        const actualSlots = [...new Set(
          matches.filter(match => matchPlayers(match).includes(player))
            .map(match => match.startTime / GAME_DURATION)
        )].sort((a, b) => a - b);

        let maxConsecutive = 1;
        let current = 1;
        for (let i = 1; i < actualSlots.length; i++) {
          if (actualSlots[i] === actualSlots[i - 1] + 1) {
            current++;
            maxConsecutive = Math.max(maxConsecutive, current);
          } else {
            current = 1;
          }
        }
        expect(maxConsecutive, `${player} played ${maxConsecutive} consecutive in ${label}`).toBeLessThanOrEqual(3);
      }
    }

    // ---- Scenario 1: Player Leaves Mid-Game ----
    it("player leaves mid-game (11 → 10 players)", () => {
      const { newMatchesOnly, newPlayers } = simulateMidGameChange(11, 5, [0], []);
      expect(newMatchesOnly.length).toBeGreaterThan(0);
      validateNoConflicts(newMatchesOnly, "after-leave");
      validateNoDuplicatesInMatch(newMatchesOnly, "after-leave");
      validateFairness(newMatchesOnly, newPlayers, "after-leave", 4);
      validateConsecutivePlay(newMatchesOnly, newPlayers, "after-leave");
    });

    // ---- Scenario 2: New Player Joins Mid-Game ----
    it("new player joins mid-game (10 → 11 players)", () => {
      const { newMatchesOnly, newPlayers } = simulateMidGameChange(10, 5, [], ["NewPlayer"]);
      expect(newMatchesOnly.length).toBeGreaterThan(0);
      validateNoConflicts(newMatchesOnly, "after-join");
      validateNoDuplicatesInMatch(newMatchesOnly, "after-join");
      validateFairness(newMatchesOnly, newPlayers, "after-join", 5);
      validateConsecutivePlay(newMatchesOnly, newPlayers, "after-join");
    });

    // ---- Scenario 3: Multiple Changes (2 leave, 1 joins) ----
    it("multiple changes: 2 leave, 1 joins (12 → 11 players)", () => {
      const { newMatchesOnly, newPlayers } = simulateMidGameChange(12, 5, [0, 1], ["NewPlayer"]);
      expect(newMatchesOnly.length).toBeGreaterThan(0);
      validateNoConflicts(newMatchesOnly, "multi-change");
      validateNoDuplicatesInMatch(newMatchesOnly, "multi-change");
      validateFairness(newMatchesOnly, newPlayers, "multi-change", 7);
      validateConsecutivePlay(newMatchesOnly, newPlayers, "multi-change");
    });

    // ---- Scenario 4: Various Player Counts with Mid-Game Changes ----
    for (const count of [8, 10, 11, 12, 14]) {
      it(`${count} players: 1 leaves, 1 joins mid-game`, () => {
        const { newMatchesOnly, newPlayers } = simulateMidGameChange(count, 5, [0], [`New_${count}`]);
        expect(newMatchesOnly.length).toBeGreaterThan(0);
        validateNoConflicts(newMatchesOnly, `swap-${count}`);
        validateNoDuplicatesInMatch(newMatchesOnly, `swap-${count}`);
        validateFairness(newMatchesOnly, newPlayers, `swap-${count}`, 5);
        validateConsecutivePlay(newMatchesOnly, newPlayers, `swap-${count}`);
      });
    }

    // ---- Scenario 5: Fairness for New Players Joining Late ----
    it("new players joining late get fair remaining play time", () => {
      const { newMatchesOnly, newPlayers } = simulateMidGameChange(10, 8, [], ["Late1", "Late2"]);
      expect(newMatchesOnly.length).toBeGreaterThan(0);
      validateNoConflicts(newMatchesOnly, "late-join");
      validateNoDuplicatesInMatch(newMatchesOnly, "late-join");

      // Check fairness only in regenerated portion
      const counts = matchCountPerPlayer(newMatchesOnly, newPlayers);
      const existingCounts = [...counts.entries()]
        .filter(([p]) => !["Late1", "Late2"].includes(p))
        .map(([, c]) => c)
        .filter(c => c > 0);
      const newCounts = [counts.get("Late1") || 0, counts.get("Late2") || 0];

      if (existingCounts.length > 0 && newCounts.some(c => c > 0)) {
        const avgExisting = existingCounts.reduce((a, b) => a + b, 0) / existingCounts.length;
        for (const nc of newCounts) {
          const diff = Math.abs(nc - avgExisting);
          console.log(`  Late player count=${nc}, avg existing=${avgExisting.toFixed(1)}, diff=${diff.toFixed(1)}`);
          expect(diff, "New player fairness").toBeLessThanOrEqual(5);
        }
      }
    });
  });
});
