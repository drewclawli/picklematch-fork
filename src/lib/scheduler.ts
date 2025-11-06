export interface Match {
  id: string;
  court: number;
  startTime: number;
  endTime: number;
  clockStartTime?: string;
  clockEndTime?: string;
  team1: [string, string];
  team2: [string, string];
  score?: {
    team1: number;
    team2: number;
  };
}

interface PlayerStats {
  playTime: number;
  restTime: number;
  partners: Set<string>;
  opponents: Set<string>;
  lastMatchEnd: number;
}

export function generateSchedule(
  players: string[],
  gameDuration: number,
  totalTime: number,
  courts: number,
  startTime?: string
): Match[] {
  const matches: Match[] = [];
  const playerStats = new Map<string, PlayerStats>();

  // Initialize player stats
  players.forEach((player) => {
    playerStats.set(player, {
      playTime: 0,
      restTime: 0,
      partners: new Set(),
      opponents: new Set(),
      lastMatchEnd: 0,
    });
  });

  const totalSlots = Math.floor(totalTime / gameDuration);
  const playersPerMatch = 4;
  const matchesPerSlot = courts;

  // Generate all possible team combinations
  const allTeams: [string, string][] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      allTeams.push([players[i], players[j]]);
    }
  }

  let matchId = 0;

  for (let slot = 0; slot < totalSlots; slot++) {
    const slotStartTime = slot * gameDuration;
    const slotEndTime = slotStartTime + gameDuration;
    const availablePlayers = new Set(players);
    
    // Remove players who just played (need rest)
    players.forEach((player) => {
      const stats = playerStats.get(player)!;
      if (stats.lastMatchEnd === slotStartTime) {
        // Player just finished, can rest
        if (Math.random() > 0.5 && availablePlayers.size > playersPerMatch * matchesPerSlot) {
          availablePlayers.delete(player);
        }
      }
    });

    for (let court = 0; court < matchesPerSlot && availablePlayers.size >= playersPerMatch; court++) {
      const match = createOptimalMatch(
        Array.from(availablePlayers),
        playerStats,
        allTeams,
        slotStartTime,
        slotEndTime,
        court + 1
      );

      if (match) {
        const matchWithId = { ...match, id: `match-${matchId++}` };
        
        // Calculate clock times if start time provided
        if (startTime) {
          const [hours, minutes] = startTime.split(':').map(Number);
          const baseMinutes = hours * 60 + minutes;
          
          const matchStartMinutes = baseMinutes + slotStartTime;
          const matchEndMinutes = matchStartMinutes + gameDuration;
          
          matchWithId.clockStartTime = formatTime(matchStartMinutes);
          matchWithId.clockEndTime = formatTime(matchEndMinutes);
        }
        
        matches.push(matchWithId);
        
        // Update player stats
        [...match.team1, ...match.team2].forEach((player) => {
          const stats = playerStats.get(player)!;
          stats.playTime += gameDuration;
          stats.lastMatchEnd = slotEndTime;
          availablePlayers.delete(player);

          // Update partners and opponents
          const [p1, p2] = match.team1;
          const [p3, p4] = match.team2;
          
          if (player === p1) {
            stats.partners.add(p2);
            stats.opponents.add(p3);
            stats.opponents.add(p4);
          } else if (player === p2) {
            stats.partners.add(p1);
            stats.opponents.add(p3);
            stats.opponents.add(p4);
          } else if (player === p3) {
            stats.partners.add(p4);
            stats.opponents.add(p1);
            stats.opponents.add(p2);
          } else {
            stats.partners.add(p3);
            stats.opponents.add(p1);
            stats.opponents.add(p2);
          }
        });
      }
    }
  }

  return matches;
}

function createOptimalMatch(
  availablePlayers: string[],
  playerStats: Map<string, PlayerStats>,
  allTeams: [string, string][],
  startTime: number,
  endTime: number,
  court: number
): Match | null {
  if (availablePlayers.length < 4) return null;

  // Sort players by play time (prioritize those who played less)
  const sortedPlayers = [...availablePlayers].sort((a, b) => {
    const statsA = playerStats.get(a)!;
    const statsB = playerStats.get(b)!;
    return statsA.playTime - statsB.playTime;
  });

  // Try to form teams with minimal repeats
  let bestScore = -Infinity;
  let bestMatch: Match | null = null;

  // Sample a subset of combinations for performance
  const maxAttempts = Math.min(100, sortedPlayers.length * 10);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Pick 4 players
    const selectedIndices = new Set<number>();
    while (selectedIndices.size < 4) {
      // Bias towards players who played less
      const idx = Math.floor(Math.pow(Math.random(), 2) * sortedPlayers.length);
      selectedIndices.add(idx);
    }
    
    const selected = Array.from(selectedIndices).map(i => sortedPlayers[i]);
    
    // Form two teams
    const [p1, p2, p3, p4] = selected;
    
    // Try different team configurations
    const configs: [[string, string], [string, string]][] = [
      [[p1, p2], [p3, p4]],
      [[p1, p3], [p2, p4]],
      [[p1, p4], [p2, p3]],
    ];

    for (const [team1, team2] of configs) {
      const score = calculateMatchScore(team1, team2, playerStats);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          id: "",
          court,
          startTime,
          endTime,
          team1,
          team2,
        };
      }
    }
  }

  return bestMatch;
}

function calculateMatchScore(
  team1: [string, string],
  team2: [string, string],
  playerStats: Map<string, PlayerStats>
): number {
  let score = 0;
  const [p1, p2] = team1;
  const [p3, p4] = team2;

  const stats1 = playerStats.get(p1)!;
  const stats2 = playerStats.get(p2)!;
  const stats3 = playerStats.get(p3)!;
  const stats4 = playerStats.get(p4)!;

  // Penalize repeated partnerships
  if (stats1.partners.has(p2)) score -= 10;
  if (stats3.partners.has(p4)) score -= 10;

  // Penalize repeated opponents
  if (stats1.opponents.has(p3) || stats1.opponents.has(p4)) score -= 5;
  if (stats2.opponents.has(p3) || stats2.opponents.has(p4)) score -= 5;

  // Reward balanced play time
  const avgPlayTime = (stats1.playTime + stats2.playTime + stats3.playTime + stats4.playTime) / 4;
  const playTimeVariance = 
    Math.abs(stats1.playTime - avgPlayTime) +
    Math.abs(stats2.playTime - avgPlayTime) +
    Math.abs(stats3.playTime - avgPlayTime) +
    Math.abs(stats4.playTime - avgPlayTime);
  score -= playTimeVariance / 10;

  return score;
}

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function regenerateScheduleFromSlot(
  players: string[],
  playedMatches: Match[],
  fromSlotStart: number,
  gameDuration: number,
  totalTime: number,
  courts: number,
  startTime?: string
): Match[] {
  const playerStats = new Map<string, PlayerStats>();

  // Initialize all players with zero stats
  players.forEach((player) => {
    playerStats.set(player, {
      playTime: 0,
      restTime: 0,
      partners: new Set(),
      opponents: new Set(),
      lastMatchEnd: 0,
    });
  });

  // Update stats from played matches
  playedMatches.forEach((match) => {
    [...match.team1, ...match.team2].forEach((player) => {
      const stats = playerStats.get(player);
      if (stats) {
        stats.playTime += gameDuration;
        stats.lastMatchEnd = match.endTime;

        const [p1, p2] = match.team1;
        const [p3, p4] = match.team2;
        
        if (player === p1) {
          stats.partners.add(p2);
          stats.opponents.add(p3);
          stats.opponents.add(p4);
        } else if (player === p2) {
          stats.partners.add(p1);
          stats.opponents.add(p3);
          stats.opponents.add(p4);
        } else if (player === p3) {
          stats.partners.add(p4);
          stats.opponents.add(p1);
          stats.opponents.add(p2);
        } else if (player === p4) {
          stats.partners.add(p3);
          stats.opponents.add(p1);
          stats.opponents.add(p2);
        }
      }
    });
  });

  // Generate new matches starting from fromSlotStart
  const newMatches: Match[] = [...playedMatches];
  const totalSlots = Math.floor(totalTime / gameDuration);
  const playersPerMatch = 4;
  const matchesPerSlot = courts;

  const allTeams: [string, string][] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      allTeams.push([players[i], players[j]]);
    }
  }

  let matchId = playedMatches.length;
  const startSlot = Math.floor(fromSlotStart / gameDuration);

  for (let slot = startSlot; slot < totalSlots; slot++) {
    const slotStartTime = slot * gameDuration;
    const slotEndTime = slotStartTime + gameDuration;
    const availablePlayers = new Set(players);
    
    players.forEach((player) => {
      const stats = playerStats.get(player);
      if (stats && stats.lastMatchEnd === slotStartTime) {
        if (Math.random() > 0.5 && availablePlayers.size > playersPerMatch * matchesPerSlot) {
          availablePlayers.delete(player);
        }
      }
    });

    for (let court = 0; court < matchesPerSlot && availablePlayers.size >= playersPerMatch; court++) {
      const match = createOptimalMatch(
        Array.from(availablePlayers),
        playerStats,
        allTeams,
        slotStartTime,
        slotEndTime,
        court + 1
      );

      if (match) {
        const matchWithId = { ...match, id: `match-${matchId++}` };
        
        if (startTime) {
          const [hours, minutes] = startTime.split(':').map(Number);
          const baseMinutes = hours * 60 + minutes;
          
          const matchStartMinutes = baseMinutes + slotStartTime;
          const matchEndMinutes = matchStartMinutes + gameDuration;
          
          matchWithId.clockStartTime = formatTime(matchStartMinutes);
          matchWithId.clockEndTime = formatTime(matchEndMinutes);
        }
        
        newMatches.push(matchWithId);
        
        [...match.team1, ...match.team2].forEach((player) => {
          const stats = playerStats.get(player)!;
          stats.playTime += gameDuration;
          stats.lastMatchEnd = slotEndTime;
          availablePlayers.delete(player);

          const [p1, p2] = match.team1;
          const [p3, p4] = match.team2;
          
          if (player === p1) {
            stats.partners.add(p2);
            stats.opponents.add(p3);
            stats.opponents.add(p4);
          } else if (player === p2) {
            stats.partners.add(p1);
            stats.opponents.add(p3);
            stats.opponents.add(p4);
          } else if (player === p3) {
            stats.partners.add(p4);
            stats.opponents.add(p1);
            stats.opponents.add(p2);
          } else {
            stats.partners.add(p3);
            stats.opponents.add(p1);
            stats.opponents.add(p2);
          }
        });
      }
    }
  }

  return newMatches;
}
