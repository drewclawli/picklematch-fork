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
  isLocked?: boolean; // Indicates if this match should be preserved
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
  matchesPerCourt: Map<number, number>; // Track matches per court
}

interface ScheduleSlot {
  timeSlot: number;
  matches: Match[];
}

// ==================== MAIN GENERATION FUNCTION ====================

export function generateSchedule(
  players: string[],
  gameDuration: number,
  totalTime: number,
  courts: number,
  startTime?: string,
  teammatePairs: TeammatePair[] = [],
  courtConfigs: CourtConfig[] = []
): Match[] {
  const finalCourtConfigs = courtConfigs.length > 0 
    ? courtConfigs 
    : Array.from({ length: courts }, (_, i) => ({ courtNumber: i + 1, type: 'doubles' as const }));

  return generateCompleteSchedule(
    players,
    gameDuration,
    totalTime,
    finalCourtConfigs,
    startTime,
    teammatePairs
  );
}

// ==================== PRE-GENERATION SCHEDULER ====================

function generateCompleteSchedule(
  players: string[],
  gameDuration: number,
  totalTime: number,
  courtConfigs: CourtConfig[],
  startTime?: string,
  teammatePairs: TeammatePair[] = []
): Match[] {
  const totalSlots = Math.floor(totalTime / gameDuration);
  const playerStats = initializePlayerStats(players, courtConfigs.length);
  const schedule: ScheduleSlot[] = [];

  // Pre-generate ALL matches for ALL time slots and courts
  for (let slot = 0; slot < totalSlots; slot++) {
    const slotStartTime = slot * gameDuration;
    const slotEndTime = slotStartTime + gameDuration;
    const slotMatches: Match[] = [];

    // Track players used in this time slot (prevents cross-court conflicts)
    const playersUsedThisSlot = new Set<string>();

    // Generate match for each court in this time slot
    for (const courtConfig of courtConfigs) {
      const availablePlayers = getAvailablePlayers(
        players,
        playerStats,
        playersUsedThisSlot,
        slotStartTime,
        gameDuration,
        courtConfigs,
        schedule,
        courtConfig.courtNumber
      );

      const playersNeeded = courtConfig.type === 'singles' ? 2 : 4;
      
      if (availablePlayers.length >= playersNeeded) {
        const match = createOptimalMatch(
          availablePlayers,
          playerStats,
          slotStartTime,
          slotEndTime,
          courtConfig.courtNumber,
          teammatePairs,
          courtConfig.type
        );

        if (match) {
          slotMatches.push(match);
          
          // Update player stats and mark players as used
          const matchPlayers = [...match.team1, ...match.team2];
          matchPlayers.forEach(player => {
            playersUsedThisSlot.add(player);
            updatePlayerStats(player, match, playerStats, gameDuration);
          });
        }
      }
    }

    schedule.push({ timeSlot: slot, matches: slotMatches });
  }

  // Flatten schedule and assign IDs, clock times
  const allMatches = schedule.flatMap(slot => slot.matches);
  return finalizeMatches(allMatches, startTime, gameDuration);
}

// ==================== PLAYER AVAILABILITY ====================

function initializePlayerStats(players: string[], courtCount: number): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>();
  players.forEach((player) => {
    stats.set(player, {
      playTime: 0,
      restTime: 0,
      partners: new Set(),
      opponents: new Set(),
      lastMatchEnd: 0,
      recentPartners: [],
      recentOpponents: [],
      consecutiveMatches: 0,
      matchesPerCourt: new Map(),
    });
  });
  return stats;
}

function getAvailablePlayers(
  allPlayers: string[],
  playerStats: Map<string, PlayerStats>,
  playersUsedThisSlot: Set<string>,
  slotStartTime: number,
  gameDuration: number,
  courtConfigs: CourtConfig[],
  schedule: ScheduleSlot[],
  currentCourt: number
): string[] {
  const minPlayersNeeded = courtConfigs.reduce((acc, config) => 
    acc + (config.type === 'singles' ? 2 : 4), 0
  );

  // Get players from previous slot on OTHER courts (avoid cross-court conflicts)
  const playersOnOtherCourtsPrevSlot = new Set<string>();
  if (schedule.length > 0) {
    const prevSlot = schedule[schedule.length - 1];
    prevSlot.matches.forEach(match => {
      if (match.court !== currentCourt) {
        [...match.team1, ...match.team2].forEach(p => playersOnOtherCourtsPrevSlot.add(p));
      }
    });
  }

  return allPlayers.filter(player => {
    // Already used in this time slot on another court
    if (playersUsedThisSlot.has(player)) return false;
    
    // Was on different court in previous slot (avoid cross-court rush)
    if (playersOnOtherCourtsPrevSlot.has(player)) return false;

    const stats = playerStats.get(player)!;
    
    // Enforce rest requirements
    if (stats.lastMatchEnd === slotStartTime) {
      const availableCount = allPlayers.filter(p => 
        !playersUsedThisSlot.has(p) && 
        !playersOnOtherCourtsPrevSlot.has(p)
      ).length;
      
      // Hard limit: Force rest after 3 consecutive matches
      if (stats.consecutiveMatches >= 3 && availableCount > minPlayersNeeded) {
        return false;
      }
      // 85% rest after 2 consecutive
      if (stats.consecutiveMatches >= 2 && availableCount > minPlayersNeeded && Math.random() < 0.85) {
        return false;
      }
      // 50% rest after 1 match
      if (stats.consecutiveMatches >= 1 && availableCount > minPlayersNeeded && Math.random() < 0.5) {
        return false;
      }
    }

    return true;
  });
}

function updatePlayerStats(
  player: string,
  match: Match,
  playerStats: Map<string, PlayerStats>,
  gameDuration: number
): void {
  const stats = playerStats.get(player)!;
  
  stats.playTime += gameDuration;
  stats.lastMatchEnd = match.endTime;
  stats.consecutiveMatches++;
  
  // Track court usage
  const courtCount = stats.matchesPerCourt.get(match.court) || 0;
  stats.matchesPerCourt.set(match.court, courtCount + 1);

  if (match.isSingles) {
    const opponent = match.team1[0] === player ? match.team2[0] : match.team1[0];
    stats.opponents.add(opponent);
    stats.recentOpponents.unshift(opponent);
    if (stats.recentOpponents.length > 6) stats.recentOpponents.pop();
  } else {
    const [p1, p2] = match.team1 as [string, string];
    const [p3, p4] = match.team2 as [string, string];
    
    let partner: string;
    let opp1: string, opp2: string;
    
    if (player === p1) { partner = p2; opp1 = p3; opp2 = p4; }
    else if (player === p2) { partner = p1; opp1 = p3; opp2 = p4; }
    else if (player === p3) { partner = p4; opp1 = p1; opp2 = p2; }
    else { partner = p3; opp1 = p1; opp2 = p2; }
    
    stats.partners.add(partner);
    stats.recentPartners.unshift(partner);
    if (stats.recentPartners.length > 3) stats.recentPartners.pop();
    
    stats.opponents.add(opp1);
    stats.opponents.add(opp2);
    stats.recentOpponents.unshift(opp1, opp2);
    if (stats.recentOpponents.length > 6) stats.recentOpponents.pop();
  }
}

// ==================== MATCH CREATION ====================

function createOptimalMatch(
  availablePlayers: string[],
  playerStats: Map<string, PlayerStats>,
  startTime: number,
  endTime: number,
  court: number,
  teammatePairs: TeammatePair[] = [],
  matchType: 'singles' | 'doubles' = 'doubles'
): Match | null {
  const playersNeeded = matchType === 'singles' ? 2 : 4;
  if (availablePlayers.length < playersNeeded) return null;

  // SINGLES LOGIC
  if (matchType === 'singles') {
    const sortedByFairness = [...availablePlayers].sort((a, b) => {
      const statsA = playerStats.get(a)!;
      const statsB = playerStats.get(b)!;
      return statsA.playTime - statsB.playTime;
    });
    
    const minPlayTime = playerStats.get(sortedByFairness[0])!.playTime;
    const fairCandidates = sortedByFairness.filter(p => 
      playerStats.get(p)!.playTime <= minPlayTime + 15
    );
    
    const shuffled = fairCandidates.sort(() => Math.random() - 0.5);
    const [p1, p2] = shuffled.slice(0, 2);
    
    return {
      id: "",
      court,
      startTime,
      endTime,
      team1: [p1] as [string],
      team2: [p2] as [string],
      status: 'scheduled',
      isSingles: true,
      isLocked: false,
    };
  }

  // DOUBLES LOGIC
  const sortedByFairness = [...availablePlayers].sort((a, b) => {
    const statsA = playerStats.get(a)!;
    const statsB = playerStats.get(b)!;
    return statsA.playTime - statsB.playTime;
  });
  
  const minPlayTime = playerStats.get(sortedByFairness[0])!.playTime;
  const fairCandidates = sortedByFairness.filter(p => 
    playerStats.get(p)!.playTime <= minPlayTime + 15
  );
  
  const candidatePool = fairCandidates.length >= 4 ? fairCandidates : sortedByFairness.slice(0, Math.min(8, sortedByFairness.length));
  
  let bestMatch: Match | null = null;
  let bestScore = -Infinity;
  const attempts = Math.min(50, candidatePool.length * 5);
  
  for (let i = 0; i < attempts; i++) {
    const shuffled = [...candidatePool].sort(() => Math.random() - 0.5);
    const fourPlayers = shuffled.slice(0, 4);
    
    if (fourPlayers.length < 4) continue;
    
    const [p1, p2, p3, p4] = fourPlayers;
    const configs = generateTeamConfigurations(p1, p2, p3, p4, teammatePairs);
    
    for (const [team1, team2] of configs) {
      const score = evaluateMatch(team1, team2, playerStats, teammatePairs);
      
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
          isLocked: false,
        };
      }
    }
  }
  
  return bestMatch;
}

function generateTeamConfigurations(
  p1: string, p2: string, p3: string, p4: string,
  teammatePairs: TeammatePair[]
): [[string, string], [string, string]][] {
  const isBoundPair = (player1: string, player2: string) => 
    teammatePairs.some(pair => 
      (pair.player1 === player1 && pair.player2 === player2) || 
      (pair.player1 === player2 && pair.player2 === player1)
    );
  
  const configs: [[string, string], [string, string]][] = [];
  
  // Check all possible bound pairs
  if (isBoundPair(p1, p2) && isBoundPair(p3, p4)) {
    configs.push([[p1, p2], [p3, p4]]);
  } else if (isBoundPair(p1, p2)) {
    configs.push([[p1, p2], [p3, p4]]);
  } else if (isBoundPair(p1, p3) && isBoundPair(p2, p4)) {
    configs.push([[p1, p3], [p2, p4]]);
  } else if (isBoundPair(p1, p3)) {
    configs.push([[p1, p3], [p2, p4]]);
  } else if (isBoundPair(p1, p4) && isBoundPair(p2, p3)) {
    configs.push([[p1, p4], [p2, p3]]);
  } else if (isBoundPair(p1, p4)) {
    configs.push([[p1, p4], [p2, p3]]);
  } else if (isBoundPair(p2, p3)) {
    configs.push([[p2, p3], [p1, p4]]);
  } else if (isBoundPair(p2, p4)) {
    configs.push([[p2, p4], [p1, p3]]);
  } else if (isBoundPair(p3, p4)) {
    configs.push([[p3, p4], [p1, p2]]);
  } else {
    // No bound pairs, try all 3 configurations
    configs.push(
      [[p1, p2], [p3, p4]],
      [[p1, p3], [p2, p4]],
      [[p1, p4], [p2, p3]]
    );
  }
  
  return configs;
}

function evaluateMatch(
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
  
  // 1. FAIRNESS - Heavily reward balanced play time
  const playTimes = [stats1.playTime, stats2.playTime, stats3.playTime, stats4.playTime];
  const avgPlayTime = playTimes.reduce((a, b) => a + b, 0) / 4;
  const variance = playTimes.reduce((sum, time) => sum + Math.abs(time - avgPlayTime), 0);
  score -= variance * 2;
  
  // 2. RANDOMIZATION - Small random bonus
  score += Math.random() * 10;
  
  // 3. BOUND PAIRS - Strong reward
  const isBoundPair1 = teammatePairs.some(pair => 
    (pair.player1 === p1 && pair.player2 === p2) || (pair.player1 === p2 && pair.player2 === p1)
  );
  const isBoundPair2 = teammatePairs.some(pair => 
    (pair.player1 === p3 && pair.player2 === p4) || (pair.player1 === p4 && pair.player2 === p3)
  );
  
  if (isBoundPair1) score += 100;
  if (isBoundPair2) score += 100;
  
  // 4. AVOID RECENT PARTNERSHIPS (unless bound)
  if (!isBoundPair1) {
    if (stats1.recentPartners[0] === p2) score -= 40;
    else if (stats1.recentPartners.includes(p2)) score -= 20;
  }
  if (!isBoundPair2) {
    if (stats3.recentPartners[0] === p4) score -= 40;
    else if (stats3.recentPartners.includes(p4)) score -= 20;
  }
  
  // 5. AVOID RECENT OPPONENTS
  if (stats1.recentOpponents.slice(0, 2).includes(p3)) score -= 30;
  if (stats1.recentOpponents.slice(0, 2).includes(p4)) score -= 30;
  if (stats2.recentOpponents.slice(0, 2).includes(p3)) score -= 30;
  if (stats2.recentOpponents.slice(0, 2).includes(p4)) score -= 30;
  
  return score;
}

// ==================== CONFLICT DETECTION & RESOLUTION ====================

function detectCrossCourtConflicts(matches: Match[], timeSlot: number): string[] {
  const matchesInSlot = matches.filter(m => m.startTime === timeSlot);
  const playerCounts = new Map<string, number>();
  
  matchesInSlot.forEach(match => {
    [...match.team1, ...match.team2].forEach(player => {
      playerCounts.set(player, (playerCounts.get(player) || 0) + 1);
    });
  });
  
  return Array.from(playerCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([player, _]) => player);
}

function resolveConflictSwap(
  matches: Match[],
  conflictSlot: number,
  court: number,
  gameDuration: number
): { success: boolean; modifiedMatches?: Match[]; swappedMatchNumber?: string } {
  const conflictMatch = matches.find(m => m.startTime === conflictSlot && m.court === court);
  if (!conflictMatch) return { success: false };
  
  // Look 2+ slots ahead on same court
  const futureSlots = [conflictSlot + gameDuration * 2, conflictSlot + gameDuration * 3, conflictSlot + gameDuration * 4];
  
  for (const futureSlot of futureSlots) {
    const futureMatch = matches.find(m => m.startTime === futureSlot && m.court === court);
    if (!futureMatch) continue;
    
    // Check if swapping would create conflicts
    const futureMatchPlayers = [...futureMatch.team1, ...futureMatch.team2];
    const hasConflict = futureMatchPlayers.some(player => {
      const otherMatches = matches.filter(m => m.startTime === conflictSlot && m.court !== court);
      return otherMatches.some(m => [...m.team1, ...m.team2].includes(player));
    });
    
    if (!hasConflict) {
      // Perform swap
      const newMatches = matches.map(m => {
        if (m.id === conflictMatch.id) {
          return { ...futureMatch, id: m.id, startTime: conflictSlot, endTime: conflictSlot + gameDuration };
        } else if (m.id === futureMatch.id) {
          return { ...conflictMatch, id: m.id, startTime: futureSlot, endTime: futureSlot + gameDuration };
        }
        return m;
      });
      
      const courtLetter = String.fromCharCode(64 + court);
      const matchNumber = matches.filter(m => m.court === court && m.startTime <= conflictSlot).length;
      
      return { 
        success: true, 
        modifiedMatches: newMatches,
        swappedMatchNumber: `${courtLetter}${matchNumber}`
      };
    }
  }
  
  return { success: false };
}

function resolveConflictModify(
  matches: Match[],
  conflictSlot: number,
  court: number,
  players: string[],
  conflictingPlayers: string[],
  gameDuration: number,
  teammatePairs: TeammatePair[] = []
): { success: boolean; modifiedMatches?: Match[]; modifiedMatchNumber?: string } {
  const conflictMatch = matches.find(m => m.startTime === conflictSlot && m.court === court);
  if (!conflictMatch) return { success: false };
  
  // Find available players (not on any court at this time)
  const playersInUse = new Set<string>();
  matches.filter(m => m.startTime === conflictSlot).forEach(m => {
    [...m.team1, ...m.team2].forEach(p => playersInUse.add(p));
  });
  
  const availablePlayers = players.filter(p => !playersInUse.has(p));
  
  if (availablePlayers.length < conflictingPlayers.length) {
    return { success: false };
  }
  
  // Replace conflicting players with available ones
  const newTeam1 = [...conflictMatch.team1].map(p => 
    conflictingPlayers.includes(p) ? availablePlayers.shift()! : p
  ) as [string, string] | [string];
  
  const newTeam2 = [...conflictMatch.team2].map(p => 
    conflictingPlayers.includes(p) ? availablePlayers.shift()! : p
  ) as [string, string] | [string];
  
  const newMatches = matches.map(m => {
    if (m.id === conflictMatch.id) {
      return { ...m, team1: newTeam1, team2: newTeam2 };
    }
    return m;
  });
  
  const courtLetter = String.fromCharCode(64 + court);
  const matchNumber = matches.filter(m => m.court === court && m.startTime <= conflictSlot).length;
  
  return { 
    success: true, 
    modifiedMatches: newMatches,
    modifiedMatchNumber: `${courtLetter}${matchNumber}`
  };
}

// ==================== SCHEDULE REGENERATION ====================

export function regenerateScheduleFromSlot(
  players: string[],
  playedMatches: Match[],
  fromSlotStart: number,
  gameDuration: number,
  totalTime: number,
  courts: number,
  startTime?: string,
  teammatePairs: TeammatePair[] = [],
  courtConfigs: CourtConfig[] = [],
  existingMatches: Match[] = []
): Match[] {
  const finalCourtConfigs = courtConfigs.length > 0
    ? courtConfigs 
    : Array.from({ length: courts }, (_, i) => ({ courtNumber: i + 1, type: 'doubles' as const }));

  const firstUnplayedSlot = Math.floor(fromSlotStart / gameDuration);
  const currentSlotStart = firstUnplayedSlot * gameDuration;
  const upNextSlotStart = (firstUnplayedSlot + 1) * gameDuration;
  
  // Check for conflicts in current and up next slots
  const preservedMatches: Match[] = [];
  const slotsToCheck = [currentSlotStart, upNextSlotStart];
  
  for (const slotStart of slotsToCheck) {
    const matchesInSlot = existingMatches.filter(m => m.startTime === slotStart);
    const conflicts = detectCrossCourtConflicts(existingMatches, slotStart);
    
    if (conflicts.length === 0 && matchesInSlot.length > 0) {
      // No conflicts - preserve these matches
      preservedMatches.push(...matchesInSlot.map(m => ({ ...m, isLocked: true })));
    } else if (conflicts.length > 0) {
      // Try to resolve conflicts
      for (const court of finalCourtConfigs) {
        const courtMatch = matchesInSlot.find(m => m.court === court.courtNumber);
        if (!courtMatch) continue;
        
        const matchPlayers = [...courtMatch.team1, ...courtMatch.team2];
        const hasConflict = matchPlayers.some(p => conflicts.includes(p));
        
        if (!hasConflict) {
          preservedMatches.push({ ...courtMatch, isLocked: true });
        } else {
          // Try swap strategy
          const swapResult = resolveConflictSwap(existingMatches, slotStart, court.courtNumber, gameDuration);
          if (swapResult.success && swapResult.modifiedMatches) {
            const resolvedMatch = swapResult.modifiedMatches.find(
              m => m.startTime === slotStart && m.court === court.courtNumber
            );
            if (resolvedMatch) {
              preservedMatches.push({ ...resolvedMatch, isLocked: true });
            }
          } else {
            // Try modify strategy
            const modifyResult = resolveConflictModify(
              existingMatches, 
              slotStart, 
              court.courtNumber, 
              players, 
              conflicts,
              gameDuration,
              teammatePairs
            );
            if (modifyResult.success && modifyResult.modifiedMatches) {
              const resolvedMatch = modifyResult.modifiedMatches.find(
                m => m.startTime === slotStart && m.court === court.courtNumber
              );
              if (resolvedMatch) {
                preservedMatches.push({ ...resolvedMatch, isLocked: true });
              }
            }
          }
        }
      }
    }
  }
  
  // Initialize player stats from played matches
  const playerStats = initializePlayerStats(players, courts);
  
  [...playedMatches, ...preservedMatches].forEach((match) => {
    [...match.team1, ...match.team2].forEach((player) => {
      updatePlayerStats(player, match, playerStats, gameDuration);
    });
  });
  
  // Generate remaining schedule
  const totalSlots = Math.floor(totalTime / gameDuration);
  const preservedSlots = new Set(preservedMatches.map(m => m.startTime));
  const newMatches: Match[] = [...playedMatches, ...preservedMatches];
  const startSlot = Math.floor(fromSlotStart / gameDuration);
  
  for (let slot = startSlot; slot < totalSlots; slot++) {
    const slotStartTime = slot * gameDuration;
    const slotEndTime = slotStartTime + gameDuration;
    
    if (preservedSlots.has(slotStartTime)) continue;
    
    const playersUsedThisSlot = new Set<string>();
    
    for (const courtConfig of finalCourtConfigs) {
      const availablePlayers = getAvailablePlayers(
        players,
        playerStats,
        playersUsedThisSlot,
        slotStartTime,
        gameDuration,
        finalCourtConfigs,
        newMatches.map(m => ({ timeSlot: Math.floor(m.startTime / gameDuration), matches: [m] })),
        courtConfig.courtNumber
      );
      
      const playersNeeded = courtConfig.type === 'singles' ? 2 : 4;
      
      if (availablePlayers.length >= playersNeeded) {
        const match = createOptimalMatch(
          availablePlayers,
          playerStats,
          slotStartTime,
          slotEndTime,
          courtConfig.courtNumber,
          teammatePairs,
          courtConfig.type
        );
        
        if (match) {
          newMatches.push(match);
          
          const matchPlayers = [...match.team1, ...match.team2];
          matchPlayers.forEach(player => {
            playersUsedThisSlot.add(player);
            updatePlayerStats(player, match, playerStats, gameDuration);
          });
        }
      }
    }
  }
  
  return finalizeMatches(newMatches, startTime, gameDuration);
}

// ==================== UTILITIES ====================

function finalizeMatches(matches: Match[], startTime?: string, gameDuration?: number): Match[] {
  return matches.map((match, index) => {
    const finalMatch = { ...match, id: match.id || `match-${index}` };
    
    if (startTime && gameDuration && !finalMatch.clockStartTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const baseMinutes = hours * 60 + minutes;
      const matchStartMinutes = baseMinutes + match.startTime;
      const matchEndMinutes = matchStartMinutes + gameDuration;
      finalMatch.clockStartTime = formatTime(matchStartMinutes);
      finalMatch.clockEndTime = formatTime(matchEndMinutes);
    }
    
    return finalMatch;
  });
}

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
