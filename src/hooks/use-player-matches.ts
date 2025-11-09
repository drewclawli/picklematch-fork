import { useMemo } from "react";
import { Match } from "@/lib/scheduler";

export interface PlayerMatchGroups {
  current: Match | null;
  upNext: Match[];
  later: Match[];
  completed: Match[];
}

export const usePlayerMatches = (
  matches: Match[],
  playerName: string | null,
  matchScores: Map<string, { team1: number; team2: number }>
): PlayerMatchGroups => {
  return useMemo(() => {
    if (!playerName) {
      return { current: null, upNext: [], later: [], completed: [] };
    }

    // Filter matches where player is participating
    const playerMatches = matches.filter((match) => {
      const allPlayers = [...match.team1, ...match.team2];
      return allPlayers.includes(playerName);
    });

    // Split into completed and upcoming
    const completed = playerMatches.filter((match) => matchScores.has(match.id));
    const upcoming = playerMatches.filter((match) => !matchScores.has(match.id));

    if (upcoming.length === 0) {
      return { current: null, upNext: [], later: [], completed };
    }

    // Group by court to find current match
    const courtGroups = new Map<number, Match[]>();
    matches.forEach((match) => {
      if (!courtGroups.has(match.court)) {
        courtGroups.set(match.court, []);
      }
      courtGroups.get(match.court)!.push(match);
    });

    // Find if player has a current match (first unscored match on any court)
    let current: Match | null = null;
    for (const playerMatch of upcoming) {
      const courtMatches = courtGroups.get(playerMatch.court) || [];
      const currentMatchIndex = courtMatches.findIndex((m) => !matchScores.has(m.id));
      
      if (currentMatchIndex >= 0 && courtMatches[currentMatchIndex].id === playerMatch.id) {
        current = playerMatch;
        break;
      }
    }

    // Remaining matches
    const remaining = upcoming.filter((m) => m.id !== current?.id);
    
    // Split into up next (next 2) and later
    const upNext = remaining.slice(0, 2);
    const later = remaining.slice(2);

    return { current, upNext, later, completed };
  }, [matches, playerName, matchScores]);
};
