export interface Match {
  id: string;
  court: number;
  startTime: number;
  endTime: number;
  clockStartTime?: string;
  clockEndTime?: string;
  team1: [string, string] | [string];
  team2: [string, string] | [string];
  score?: {
    team1: number;
    team2: number;
  };
  status?: 'scheduled' | 'in-progress' | 'completed';
  actualEndTime?: number;
  isSingles?: boolean;
}

export interface CourtConfig {
  courtNumber: number;
  type: 'singles' | 'doubles';
}

export interface TeammatePair {
  player1: string;
  player2: string;
}

interface PlayerStats {
  playTime: number;
  restTime: number;
  partners: Set<string>;
  opponents: Set<string>;
  lastMatchEnd: number;
  recentPartners: string[]; // Track last 3 partners
  recentOpponents: string[]; // Track last 6 opponents
  consecutiveMatches: number; // Count consecutive matches without rest
}

export function generateSchedule(
  players: string[],
  gameDuration: number,
  totalTime: number,
  courts: number,
  startTime?: string,
  teammatePairs: TeammatePair[] = [],
  courtConfigs: CourtConfig[] = []
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
      recentPartners: [],
      recentOpponents: [],
      consecutiveMatches: 0,
    });
  });

  const totalSlots = Math.floor(totalTime / gameDuration);
  const matchesPerSlot = courts;
  
  // Initialize court configs if not provided (default to doubles)
  const finalCourtConfigs = courtConfigs.length > 0 
    ? courtConfigs 
    : Array.from({ length: courts }, (_, i) => ({ courtNumber: i + 1, type: 'doubles' as const }));

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
    
    // Get players scheduled in previous slot by court to prevent cross-court disruptions
    const previousSlotPlayersByCourt = new Map<number, Set<string>>();
    if (slot > 0) {
      const prevSlotStart = (slot - 1) * gameDuration;
      matches
        .filter(m => m.startTime === prevSlotStart)
        .forEach(m => {
          const playersInMatch = new Set([...m.team1, ...m.team2]);
          previousSlotPlayersByCourt.set(m.court, playersInMatch);
        });
    }
    
    // Enforce rest after consecutive matches or recent play
    players.forEach((player) => {
      const stats = playerStats.get(player)!;
      const minPlayersNeeded = finalCourtConfigs.reduce((acc, config) => 
        acc + (config.type === 'singles' ? 2 : 4), 0
      );
      
      // Force rest after playing in previous slot if played 2+ consecutive matches
      if (stats.lastMatchEnd === slotStartTime && stats.consecutiveMatches >= 2) {
        if (availablePlayers.size > minPlayersNeeded) {
          availablePlayers.delete(player);
          stats.restTime += gameDuration;
          stats.consecutiveMatches = 0;
        }
      }
      // Encourage rest after playing in previous slot (70% chance)
      else if (stats.lastMatchEnd === slotStartTime && availablePlayers.size > minPlayersNeeded) {
        if (Math.random() < 0.7) {
          availablePlayers.delete(player);
          stats.restTime += gameDuration;
          stats.consecutiveMatches = 0;
        }
      }
    });

    // Track which players are already scheduled in this time slot (prevents court conflicts)
    const playersScheduledThisSlot = new Set<string>();
    
    for (let court = 0; court < matchesPerSlot; court++) {
      const courtConfig = finalCourtConfigs[court];
      const playersNeeded = courtConfig.type === 'singles' ? 2 : 4;
      const courtNumber = court + 1;
      
      // Get players who were on THIS court in previous slot (they can stay on same court)
      const playersOnThisCourtPrevSlot = previousSlotPlayersByCourt.get(courtNumber) || new Set();
      
      // Get players who were on OTHER courts in previous slot (they should NOT be on this court)
      const playersOnOtherCourtsPrevSlot = new Set<string>();
      previousSlotPlayersByCourt.forEach((players, prevCourt) => {
        if (prevCourt !== courtNumber) {
          players.forEach(p => playersOnOtherCourtsPrevSlot.add(p));
        }
      });
      
      // Filter out players already scheduled on other courts in this slot
      // AND players who were on different courts in previous slot (prevents cross-court rushes)
      const availableForThisCourt = Array.from(availablePlayers).filter(
        p => !playersScheduledThisSlot.has(p) && !playersOnOtherCourtsPrevSlot.has(p)
      );
      
      if (availableForThisCourt.length < playersNeeded) continue;
      
      const match = createOptimalMatch(
        availableForThisCourt,
        playerStats,
        allTeams,
        slotStartTime,
        slotEndTime,
        court + 1,
        teammatePairs,
        courtConfig.type
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
          stats.consecutiveMatches++;
          availablePlayers.delete(player);
          playersScheduledThisSlot.add(player); // Prevent same player on multiple courts

          // Update partners and opponents
          if (match.isSingles) {
            const opponent = match.team1[0] === player ? match.team2[0] : match.team1[0];
            stats.opponents.add(opponent);
            stats.recentOpponents.unshift(opponent);
            if (stats.recentOpponents.length > 6) stats.recentOpponents.pop();
          } else {
            const [p1, p2] = match.team1 as [string, string];
            const [p3, p4] = match.team2 as [string, string];
            
            if (player === p1) {
              stats.partners.add(p2);
              stats.recentPartners.unshift(p2);
              stats.opponents.add(p3);
              stats.opponents.add(p4);
              stats.recentOpponents.unshift(p3, p4);
            } else if (player === p2) {
              stats.partners.add(p1);
              stats.recentPartners.unshift(p1);
              stats.opponents.add(p3);
              stats.opponents.add(p4);
              stats.recentOpponents.unshift(p3, p4);
            } else if (player === p3) {
              stats.partners.add(p4);
              stats.recentPartners.unshift(p4);
              stats.opponents.add(p1);
              stats.opponents.add(p2);
              stats.recentOpponents.unshift(p1, p2);
            } else {
              stats.partners.add(p3);
              stats.recentPartners.unshift(p3);
              stats.opponents.add(p1);
              stats.opponents.add(p2);
              stats.recentOpponents.unshift(p1, p2);
            }
            
            // Keep only last 3 partners and 6 opponents
            if (stats.recentPartners.length > 3) stats.recentPartners.pop();
            if (stats.recentOpponents.length > 6) stats.recentOpponents.pop();
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
  court: number,
  teammatePairs: TeammatePair[] = [],
  matchType: 'singles' | 'doubles' = 'doubles'
): Match | null {
  const playersNeeded = matchType === 'singles' ? 2 : 4;
  if (availablePlayers.length < playersNeeded) return null;

  // Handle singles matches
  if (matchType === 'singles') {
    const sortedPlayers = [...availablePlayers].sort((a, b) => {
      const statsA = playerStats.get(a)!;
      const statsB = playerStats.get(b)!;
      return statsA.playTime - statsB.playTime;
    });

    let bestScore = -Infinity;
    let bestMatch: Match | null = null;
    const maxAttempts = Math.min(20, sortedPlayers.length * 5);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const selectedIndices = new Set<number>();
      while (selectedIndices.size < 2) {
        const idx = Math.floor(Math.pow(Math.random(), 2) * sortedPlayers.length);
        selectedIndices.add(idx);
      }
      const selected = Array.from(selectedIndices).map(i => sortedPlayers[i]);
      const [p1, p2] = selected;

      const stats1 = playerStats.get(p1)!;
      const stats2 = playerStats.get(p2)!;

      let score = 0;
      if (stats1.opponents.has(p2)) score -= 5;
      const avgPlayTime = (stats1.playTime + stats2.playTime) / 2;
      const playTimeVariance = Math.abs(stats1.playTime - avgPlayTime) + Math.abs(stats2.playTime - avgPlayTime);
      score -= playTimeVariance / 10;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          id: "",
          court,
          startTime,
          endTime,
          team1: [p1] as [string],
          team2: [p2] as [string],
          status: 'scheduled',
          isSingles: true,
        };
      }
    }

    return bestMatch;
  }

  // Sort players by play time (prioritize those who played less)
  const sortedPlayers = [...availablePlayers].sort((a, b) => {
    const statsA = playerStats.get(a)!;
    const statsB = playerStats.get(b)!;
    return statsA.playTime - statsB.playTime;
  });

  // Check if we have any bound pairs that can play together
  const availablePairs = teammatePairs.filter(pair => 
    availablePlayers.includes(pair.player1) && availablePlayers.includes(pair.player2)
  );

  // Try to form teams with minimal repeats
  let bestScore = -Infinity;
  let bestMatch: Match | null = null;

  // Sample a subset of combinations for performance
  const maxAttempts = Math.min(100, sortedPlayers.length * 10);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let selected: string[];
    let configs: [[string, string], [string, string]][];

    // If we have bound pairs, try to use at least one
    if (availablePairs.length > 0 && Math.random() < 0.7) {
      const pair = availablePairs[Math.floor(Math.random() * availablePairs.length)];
      const remainingPlayers = sortedPlayers.filter(p => p !== pair.player1 && p !== pair.player2);
      
      if (remainingPlayers.length >= 2) {
        const selectedIndices = new Set<number>();
        while (selectedIndices.size < 2) {
          const idx = Math.floor(Math.pow(Math.random(), 2) * remainingPlayers.length);
          selectedIndices.add(idx);
        }
        const otherTwo = Array.from(selectedIndices).map(i => remainingPlayers[i]);
        selected = [pair.player1, pair.player2, ...otherTwo];
        
        // Only try configs where the bound pair stays together
        configs = [
          [[selected[0], selected[1]], [selected[2], selected[3]]],
        ];
      } else {
        continue;
      }
    } else {
      // Pick 4 players normally
      const selectedIndices = new Set<number>();
      while (selectedIndices.size < 4) {
        const idx = Math.floor(Math.pow(Math.random(), 2) * sortedPlayers.length);
        selectedIndices.add(idx);
      }
      
      selected = Array.from(selectedIndices).map(i => sortedPlayers[i]);
      
      const [p1, p2, p3, p4] = selected;
      
      // Check for bound pairs and respect them
      const isBoundPair12 = teammatePairs.some(pair => 
        (pair.player1 === p1 && pair.player2 === p2) || (pair.player1 === p2 && pair.player2 === p1)
      );
      const isBoundPair34 = teammatePairs.some(pair => 
        (pair.player1 === p3 && pair.player2 === p4) || (pair.player1 === p4 && pair.player2 === p3)
      );
      
      // Generate configs that respect bound pairs
      if (isBoundPair12 && isBoundPair34) {
        configs = [[[p1, p2], [p3, p4]]];
      } else if (isBoundPair12) {
        configs = [[[p1, p2], [p3, p4]]];
      } else if (isBoundPair34) {
        configs = [[[p1, p3], [p2, p4]], [[p1, p4], [p2, p3]]];
      } else {
        configs = [
          [[p1, p2], [p3, p4]],
          [[p1, p3], [p2, p4]],
          [[p1, p4], [p2, p3]],
        ];
      }
    }

    for (const [team1, team2] of configs) {
      const score = calculateMatchScore(team1, team2, playerStats, teammatePairs);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          id: "",
          court,
          startTime,
          endTime,
          team1,
          team2,
          status: 'scheduled',
        };
      }
    }
  }

  return bestMatch;
}

function calculateMatchScore(
  team1: [string, string],
  team2: [string, string],
  playerStats: Map<string, PlayerStats>,
  teammatePairs: TeammatePair[] = []
): number {
  let score = 0;
  const [p1, p2] = team1;
  const [p3, p4] = team2;

  const stats1 = playerStats.get(p1)!;
  const stats2 = playerStats.get(p2)!;
  const stats3 = playerStats.get(p3)!;
  const stats4 = playerStats.get(p4)!;

  // Reward bound pairs playing together (highest priority)
  const isBoundPair1 = teammatePairs.some(pair => 
    (pair.player1 === p1 && pair.player2 === p2) || (pair.player1 === p2 && pair.player2 === p1)
  );
  const isBoundPair2 = teammatePairs.some(pair => 
    (pair.player1 === p3 && pair.player2 === p4) || (pair.player1 === p4 && pair.player2 === p3)
  );
  if (isBoundPair1) score += 100;
  if (isBoundPair2) score += 100;

  // Heavily penalize recent partnerships (unless they're bound)
  if (!isBoundPair1) {
    if (stats1.recentPartners[0] === p2) score -= 50; // Just played together
    else if (stats1.recentPartners.includes(p2)) score -= 25; // Played together recently
    else if (stats1.partners.has(p2)) score -= 10; // Played together before
  }
  if (!isBoundPair2) {
    if (stats3.recentPartners[0] === p4) score -= 50;
    else if (stats3.recentPartners.includes(p4)) score -= 25;
    else if (stats3.partners.has(p4)) score -= 10;
  }

  // Heavily penalize recent opponents (reduces back-to-back rematches)
  const p1RecentOpponents = stats1.recentOpponents.slice(0, 4);
  const p2RecentOpponents = stats2.recentOpponents.slice(0, 4);
  
  if (p1RecentOpponents.includes(p3) || p1RecentOpponents.includes(p4)) score -= 30;
  if (p2RecentOpponents.includes(p3) || p2RecentOpponents.includes(p4)) score -= 30;
  
  // Lighter penalty for all-time opponents
  if (stats1.opponents.has(p3) || stats1.opponents.has(p4)) score -= 5;
  if (stats2.opponents.has(p3) || stats2.opponents.has(p4)) score -= 5;

  // Penalize players with high consecutive match counts
  const totalConsecutive = stats1.consecutiveMatches + stats2.consecutiveMatches + 
                           stats3.consecutiveMatches + stats4.consecutiveMatches;
  score -= totalConsecutive * 15;

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
  startTime?: string,
  teammatePairs: TeammatePair[] = [],
  courtConfigs: CourtConfig[] = []
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
      recentPartners: [],
      recentOpponents: [],
      consecutiveMatches: 0,
    });
  });

  // Update stats from played matches
  playedMatches.forEach((match) => {
    [...match.team1, ...match.team2].forEach((player) => {
      const stats = playerStats.get(player);
      if (stats) {
        stats.playTime += gameDuration;
        stats.lastMatchEnd = match.endTime;
        stats.consecutiveMatches++;

        const [p1, p2] = match.team1;
        const [p3, p4] = match.team2;
        
        if (player === p1) {
          stats.partners.add(p2);
          stats.recentPartners.unshift(p2);
          stats.opponents.add(p3);
          stats.opponents.add(p4);
          stats.recentOpponents.unshift(p3, p4);
        } else if (player === p2) {
          stats.partners.add(p1);
          stats.recentPartners.unshift(p1);
          stats.opponents.add(p3);
          stats.opponents.add(p4);
          stats.recentOpponents.unshift(p3, p4);
        } else if (player === p3) {
          stats.partners.add(p4);
          stats.recentPartners.unshift(p4);
          stats.opponents.add(p1);
          stats.opponents.add(p2);
          stats.recentOpponents.unshift(p1, p2);
        } else if (player === p4) {
          stats.partners.add(p3);
          stats.recentPartners.unshift(p3);
          stats.opponents.add(p1);
          stats.opponents.add(p2);
          stats.recentOpponents.unshift(p1, p2);
        }
        
        // Keep only last 3 partners and 6 opponents
        if (stats.recentPartners.length > 3) stats.recentPartners.pop();
        if (stats.recentOpponents.length > 6) stats.recentOpponents.pop();
      }
    });
  });

  // Generate new matches starting from fromSlotStart
  const newMatches: Match[] = [...playedMatches];
  const totalSlots = Math.floor(totalTime / gameDuration);
  const matchesPerSlot = courts;
  
  // Initialize court configs if not provided (default to doubles)
  const finalCourtConfigs = courtConfigs.length > 0 
    ? courtConfigs 
    : Array.from({ length: courts }, (_, i) => ({ courtNumber: i + 1, type: 'doubles' as const }));

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
    
    // Get players scheduled in previous slot by court to prevent cross-court disruptions
    const previousSlotPlayersByCourt = new Map<number, Set<string>>();
    if (slot > 0) {
      const prevSlotStart = (slot - 1) * gameDuration;
      newMatches
        .filter(m => m.startTime === prevSlotStart)
        .forEach(m => {
          const playersInMatch = new Set([...m.team1, ...m.team2]);
          previousSlotPlayersByCourt.set(m.court, playersInMatch);
        });
    }
    
    // Enforce rest after consecutive matches or recent play
    players.forEach((player) => {
      const stats = playerStats.get(player);
      if (!stats) return;
      
      const minPlayersNeeded = finalCourtConfigs.reduce((acc, config) => 
        acc + (config.type === 'singles' ? 2 : 4), 0
      );
      
      // Force rest after playing in previous slot if played 2+ consecutive matches
      if (stats.lastMatchEnd === slotStartTime && stats.consecutiveMatches >= 2) {
        if (availablePlayers.size > minPlayersNeeded) {
          availablePlayers.delete(player);
          stats.restTime += gameDuration;
          stats.consecutiveMatches = 0;
        }
      }
      // Encourage rest after playing in previous slot (70% chance)
      else if (stats.lastMatchEnd === slotStartTime && availablePlayers.size > minPlayersNeeded) {
        if (Math.random() < 0.7) {
          availablePlayers.delete(player);
          stats.restTime += gameDuration;
          stats.consecutiveMatches = 0;
        }
      }
    });

    // Track which players are already scheduled in this time slot (prevents court conflicts)
    const playersScheduledThisSlot = new Set<string>();
    
    for (let court = 0; court < matchesPerSlot; court++) {
      const courtConfig = finalCourtConfigs[court];
      const playersNeeded = courtConfig.type === 'singles' ? 2 : 4;
      const courtNumber = court + 1;
      
      // Get players who were on THIS court in previous slot (they can stay on same court)
      const playersOnThisCourtPrevSlot = previousSlotPlayersByCourt.get(courtNumber) || new Set();
      
      // Get players who were on OTHER courts in previous slot (they should NOT be on this court)
      const playersOnOtherCourtsPrevSlot = new Set<string>();
      previousSlotPlayersByCourt.forEach((players, prevCourt) => {
        if (prevCourt !== courtNumber) {
          players.forEach(p => playersOnOtherCourtsPrevSlot.add(p));
        }
      });
      
      // Filter out players already scheduled on other courts in this slot
      // AND players who were on different courts in previous slot (prevents cross-court rushes)
      const availableForThisCourt = Array.from(availablePlayers).filter(
        p => !playersScheduledThisSlot.has(p) && !playersOnOtherCourtsPrevSlot.has(p)
      );
      
      if (availableForThisCourt.length < playersNeeded) continue;
      
      const match = createOptimalMatch(
        availableForThisCourt,
        playerStats,
        allTeams,
        slotStartTime,
        slotEndTime,
        court + 1,
        teammatePairs,
        courtConfig.type
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
          stats.consecutiveMatches++;
          availablePlayers.delete(player);
          playersScheduledThisSlot.add(player); // Prevent same player on multiple courts

          if (match.isSingles) {
            const opponent = match.team1[0] === player ? match.team2[0] : match.team1[0];
            stats.opponents.add(opponent);
            stats.recentOpponents.unshift(opponent);
            if (stats.recentOpponents.length > 6) stats.recentOpponents.pop();
          } else {
            const [p1, p2] = match.team1 as [string, string];
            const [p3, p4] = match.team2 as [string, string];
            
            if (player === p1) {
              stats.partners.add(p2);
              stats.recentPartners.unshift(p2);
              stats.opponents.add(p3);
              stats.opponents.add(p4);
              stats.recentOpponents.unshift(p3, p4);
            } else if (player === p2) {
              stats.partners.add(p1);
              stats.recentPartners.unshift(p1);
              stats.opponents.add(p3);
              stats.opponents.add(p4);
              stats.recentOpponents.unshift(p3, p4);
            } else if (player === p3) {
              stats.partners.add(p4);
              stats.recentPartners.unshift(p4);
              stats.opponents.add(p1);
              stats.opponents.add(p2);
              stats.recentOpponents.unshift(p1, p2);
            } else {
              stats.partners.add(p3);
              stats.recentPartners.unshift(p3);
              stats.opponents.add(p1);
              stats.opponents.add(p2);
              stats.recentOpponents.unshift(p1, p2);
            }
            
            // Keep only last 3 partners and 6 opponents
            if (stats.recentPartners.length > 3) stats.recentPartners.pop();
            if (stats.recentOpponents.length > 6) stats.recentOpponents.pop();
          }
        });
      }
    }
  }

  return newMatches;
}
