export type SchedulingType = 'round-robin' | 'single-elimination' | 'double-elimination' | 'qualifier-tournament';

export interface TournamentMetadata {
  bracketType: 'winners' | 'losers' | 'finals' | 'grand-finals' | 'third-place';
  round: number;
  roundName: string;
  matchNumber: number;
  bracketPosition?: string;
  advancesTo?: string;
  advancesToSlot?: 'team1' | 'team2';
  loserAdvancesTo?: string;
  loserAdvancesToSlot?: 'team1' | 'team2';
  sourceMatch1?: string;
  sourceMatch2?: string;
  seed1?: number;
  seed2?: number;
}

export interface QualifierMetadata {
  groupId: string;
  groupSize: 2 | 3 | 4;
  groupMatchNum: number;
  isGroupStage: boolean;
  advancesToKnockout?: boolean;
  // For groups of 4 bracket progression
  isGroupSemifinal?: boolean;
  isGroupFinal?: boolean;
  advancesToGroupMatch?: string; // For semifinals → final
  sourceGroupMatch1?: string; // For finals (which semifinals feed in)
  sourceGroupMatch2?: string;
}

export interface GroupStanding {
  team: string[];
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
}

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
  status?: 'scheduled' | 'in-progress' | 'completed' | 'waiting' | 'bye';
  actualEndTime?: number;
  isSingles?: boolean;
  isLocked?: boolean;
  timerStartTime?: number;
  elapsedTime?: string;
  tournamentMetadata?: TournamentMetadata;
  qualifierMetadata?: QualifierMetadata;
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
  recentPartners: string[];
  recentOpponents: string[];
  consecutiveMatches: number;
  matchesPerCourt: Map<number, number>;
}

// ==================== MATCHUP TRACKING ====================

class MatchupTracker {
  private matchups: Set<string>;
  
  constructor() {
    this.matchups = new Set();
  }
  
  private createMatchupKey(player1: string, player2: string): string {
    // Sort alphabetically to ensure "A-B" === "B-A"
    return [player1, player2].sort().join('-');
  }
  
  hasMatchup(player1: string, player2: string): boolean {
    return this.matchups.has(this.createMatchupKey(player1, player2));
  }
  
  addMatchup(player1: string, player2: string): void {
    this.matchups.add(this.createMatchupKey(player1, player2));
  }
  
  // For doubles, track all opponent pairings (not teammates)
  addDoublesMatch(team1: [string, string], team2: [string, string]): void {
    // Track all opponent combinations (4 total)
    this.addMatchup(team1[0], team2[0]);
    this.addMatchup(team1[0], team2[1]);
    this.addMatchup(team1[1], team2[0]);
    this.addMatchup(team1[1], team2[1]);
  }
  
  // For singles, track the single opponent pairing
  addSinglesMatch(player1: string, player2: string): void {
    this.addMatchup(player1, player2);
  }
  
  // Check if a doubles match configuration has been played before
  hasDoublesMatchup(team1: [string, string], team2: [string, string]): boolean {
    // Check if ANY opponent pairing has been played before
    return this.hasMatchup(team1[0], team2[0]) ||
           this.hasMatchup(team1[0], team2[1]) ||
           this.hasMatchup(team1[1], team2[0]) ||
           this.hasMatchup(team1[1], team2[1]);
  }
}

interface ScheduleSlot {
  timeSlot: number;
  matches: Match[];
}

// ==================== QUEUE SYSTEMS ====================

class PlayerRotationQueue {
  private queue: string[];
  private playerStats: Map<string, PlayerStats>;
  
  constructor(players: string[], stats: Map<string, PlayerStats>) {
    this.playerStats = stats;
    this.queue = this.sortPlayers(players);
  }
  
  private sortPlayers(players: string[]): string[] {
    return [...players].sort((a, b) => {
      const statsA = this.playerStats.get(a)!;
      const statsB = this.playerStats.get(b)!;
      
      // Primary: least play time
      if (statsA.playTime !== statsB.playTime) {
        return statsA.playTime - statsB.playTime;
      }
      
      // Secondary: finished playing longest ago
      if (statsA.lastMatchEnd !== statsB.lastMatchEnd) {
        return statsA.lastMatchEnd - statsB.lastMatchEnd;
      }
      
      // Tertiary: alphabetical (for determinism)
      return a.localeCompare(b);
    });
  }
  
  getNextPlayers(count: number, excludePlayers: Set<string>): string[] {
    const available = this.queue.filter(p => !excludePlayers.has(p));
    return available.slice(0, count);
  }
  
  updateAfterMatch() {
    // Re-sort entire queue after players finish match
    this.queue = this.sortPlayers(this.queue);
  }
}

interface RestQueueEntry {
  player: string;
  availableAfter: number;
  reason: 'consecutive_2' | 'consecutive_3';
}

class RestQueue {
  private queue: RestQueueEntry[] = [];
  
  addToRest(player: string, currentSlot: number, consecutiveCount: number) {
    const restSlots = consecutiveCount >= 3 ? 3 : (consecutiveCount >= 2 ? 2 : 1);
    this.queue.push({
      player,
      availableAfter: currentSlot + restSlots,
      reason: consecutiveCount >= 3 ? 'consecutive_3' : 'consecutive_2'
    });
  }
  
  isResting(player: string, slot: number): boolean {
    return this.queue.some(entry => 
      entry.player === player && entry.availableAfter > slot
    );
  }
  
  cleanup(currentSlot: number) {
    // Remove expired entries
    this.queue = this.queue.filter(entry => entry.availableAfter > currentSlot);
  }
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
  // Pre-generate 50 games per court
  const totalSlots = 50;
  const playerStats = initializePlayerStats(players, courtConfigs.length);
  const rotationQueue = new PlayerRotationQueue(players, playerStats);
  const restQueue = new RestQueue();
  const matchupTracker = new MatchupTracker(); // Track all previous matchups
  const schedule: ScheduleSlot[] = [];

  // Generate SLOT BY SLOT (not court by court) to prevent conflicts
  for (let slot = 0; slot < totalSlots; slot++) {
    const slotStartTime = slot * gameDuration;
    const slotEndTime = slotStartTime + gameDuration;
    const slotMatches: Match[] = [];
    const playersUsedThisSlot = new Set<string>();
    
    restQueue.cleanup(slot);

    // Generate matches for ALL courts in this slot
    const courtOrder = slot % 2 === 0 ? courtConfigs : [...courtConfigs].reverse();
    for (const courtConfig of courtOrder) {
      // CRITICAL: Exclude all players already used in THIS slot (current matches across courts)
      const excludedPlayers = new Set([
        ...playersUsedThisSlot, // Players in current/next matches on ALL courts in this slot
        ...getPreviousSlotPlayersOnOtherCourts(schedule, slot, courtConfig.courtNumber),
        ...getRestingPlayers(restQueue, slot, players)
      ]);
      
      // Get deterministic player selection from rotation queue
      const playersNeeded = courtConfig.type === 'singles' ? 2 : 4;
      // Use a larger pool to allow pairing bound teammates
      let pool = rotationQueue.getNextPlayers(20, excludedPlayers);

      // Further filter by lookahead conflicts
      pool = pool.filter(p =>
        !wouldCreateFutureConflict(p, slot, courtConfig.courtNumber, schedule, gameDuration, 3)
      );

      // Select players, prioritizing complete teammate pairs when possible
      const selectedPlayers = courtConfig.type === 'doubles'
        ? selectPlayersWithPairs(pool, teammatePairs, playersNeeded)
        : pool.slice(0, playersNeeded);
      
      if (selectedPlayers.length >= playersNeeded) {
        const match = createDeterministicMatch(
          selectedPlayers,
          playerStats,
          slotStartTime,
          slotEndTime,
          courtConfig.courtNumber,
          teammatePairs,
          courtConfig.type,
          matchupTracker // Pass matchup tracker
        );
        
        if (match) {
          slotMatches.push(match);
          const matchPlayers = [...match.team1, ...match.team2];
          
          // Record this matchup in the tracker
          if (courtConfig.type === 'singles') {
            matchupTracker.addSinglesMatch(match.team1[0], match.team2[0]);
          } else {
            matchupTracker.addDoublesMatch(match.team1 as [string, string], match.team2 as [string, string]);
          }
          
          matchPlayers.forEach(player => {
            playersUsedThisSlot.add(player);
            updatePlayerStats(player, match, playerStats, gameDuration);
            
            const stats = playerStats.get(player)!;
            if (stats.consecutiveMatches >= 2) {
              restQueue.addToRest(player, slot, stats.consecutiveMatches);
            }
          });
          
          rotationQueue.updateAfterMatch();
        }
      }
    }

    schedule.push({ timeSlot: slot, matches: slotMatches });
  }

  const allMatches = schedule.flatMap(slot => slot.matches);
  return finalizeMatches(allMatches, startTime, gameDuration);
}

// ==================== CONFLICT PREVENTION ====================

function wouldCreateFutureConflict(
  player: string,
  currentSlot: number,
  currentCourt: number,
  schedule: ScheduleSlot[],
  gameDuration: number,
  lookaheadSlots: number = 3
): boolean {
  // Check if player is scheduled in next N slots on OTHER courts
  for (let i = 1; i <= lookaheadSlots; i++) {
    const futureSlotIndex = currentSlot + i;
    if (futureSlotIndex >= schedule.length) continue;
    
    const futureSlot = schedule[futureSlotIndex];
    if (!futureSlot) continue;
    
    const hasConflict = futureSlot.matches.some(match => 
      match.court !== currentCourt && 
      [...match.team1, ...match.team2].includes(player)
    );
    
    if (hasConflict) return true;
  }
  
  return false;
}

function getPreviousSlotPlayersOnOtherCourts(
  schedule: ScheduleSlot[],
  currentSlot: number,
  currentCourt: number
): string[] {
  if (currentSlot === 0 || schedule.length === 0) return [];
  
  const prevSlot = schedule[currentSlot - 1];
  if (!prevSlot) return [];
  
  const players: string[] = [];
  prevSlot.matches.forEach(match => {
    if (match.court !== currentCourt) {
      players.push(...match.team1, ...match.team2);
    }
  });
  
  return players;
}

function getRestingPlayers(
  restQueue: RestQueue,
  currentSlot: number,
  allPlayers: string[]
): string[] {
  return allPlayers.filter(player => restQueue.isResting(player, currentSlot));
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

function createDeterministicMatch(
  availablePlayers: string[],
  playerStats: Map<string, PlayerStats>,
  startTime: number,
  endTime: number,
  court: number,
  teammatePairs: TeammatePair[] = [],
  matchType: 'singles' | 'doubles' = 'doubles',
  matchupTracker?: MatchupTracker
): Match | null {
  const playersNeeded = matchType === 'singles' ? 2 : 4;
  if (availablePlayers.length < playersNeeded) return null;

  // Generate unique ID based on court and time slot to prevent duplicates
  const uniqueId = `match-c${court}-t${startTime}`;

  // SINGLES: Take first 2 players from deterministic queue
  if (matchType === 'singles') {
    const [p1, p2] = availablePlayers.slice(0, 2);
    
    // Check for duplicate matchup
    if (matchupTracker && matchupTracker.hasMatchup(p1, p2)) {
      // Try to find alternative players
      for (let i = 0; i < availablePlayers.length - 1; i++) {
        for (let j = i + 1; j < availablePlayers.length; j++) {
          if (!matchupTracker.hasMatchup(availablePlayers[i], availablePlayers[j])) {
            return {
              id: uniqueId,
              court,
              startTime,
              endTime,
              team1: [availablePlayers[i]] as [string],
              team2: [availablePlayers[j]] as [string],
              status: 'scheduled',
              isSingles: true,
              isLocked: false,
            };
          }
        }
      }
      // All matchups exhausted, allow repeat
    }
    
    return {
      id: uniqueId,
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

  // DOUBLES: Take first 4 players and find best configuration deterministically
  const [p1, p2, p3, p4] = availablePlayers.slice(0, 4);
  const configs = generateTeamConfigurations(p1, p2, p3, p4, teammatePairs);
  
  let bestMatch: Match | null = null;
  let bestScore = -Infinity;
  
  // If matchup tracker exists, prioritize configurations without duplicate matchups
  if (matchupTracker) {
    const freshConfigs: [[string, string], [string, string]][] = [];
    const usedConfigs: [[string, string], [string, string]][] = [];
    
    for (const config of configs) {
      if (matchupTracker.hasDoublesMatchup(config[0], config[1])) {
        usedConfigs.push(config);
      } else {
        freshConfigs.push(config);
      }
    }
    
    // Prioritize fresh matchups
    const prioritizedConfigs = [...freshConfigs, ...usedConfigs];
    
    for (const [team1, team2] of prioritizedConfigs) {
      const score = evaluateMatchDeterministic(team1, team2, playerStats, teammatePairs, court);
      
      // Bonus for fresh matchups
      const freshBonus = !matchupTracker.hasDoublesMatchup(team1, team2) ? 1000 : 0;
      
      if (score + freshBonus > bestScore) {
        bestScore = score + freshBonus;
        bestMatch = {
          id: uniqueId,
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
  } else {
    // Original logic without matchup tracking
    for (const [team1, team2] of configs) {
      const score = evaluateMatchDeterministic(team1, team2, playerStats, teammatePairs, court);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          id: uniqueId,
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
  
  // Check all possible bound pairs first
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
    // No bound pairs, try all 3 configurations in deterministic order
    configs.push(
      [[p1, p2], [p3, p4]],
      [[p1, p3], [p2, p4]],
      [[p1, p4], [p2, p3]]
    );
  }
  
  return configs;
}

function selectPlayersWithPairs(pool: string[], teammatePairs: TeammatePair[], playersNeeded: number): string[] {
  // Only meaningful for doubles (4 players)
  if (playersNeeded !== 4) return pool.slice(0, playersNeeded);

  // Build partner lookup
  const partnerMap = new Map<string, string>();
  teammatePairs.forEach(({ player1, player2 }) => {
    partnerMap.set(player1, player2);
    partnerMap.set(player2, player1);
  });

  const inPool = new Set(pool);

  // Find complete pairs present in the pool and rank them by queue proximity (index sum)
  const pairsInPool: Array<{ a: string; b: string; priority: number }> = [];
  pool.forEach((p, idx) => {
    const partner = partnerMap.get(p);
    if (!partner) return;
    const jdx = pool.indexOf(partner);
    if (jdx === -1) return;
    // Avoid duplicates: only record when idx < jdx
    if (idx < jdx) {
      pairsInPool.push({ a: p, b: partner, priority: idx + jdx });
    }
  });

  pairsInPool.sort((x, y) => x.priority - y.priority);

  const selected = new Set<string>();
  const result: string[] = [];

  // Try to select two full pairs first
  for (const { a, b } of pairsInPool) {
    if (result.length >= 4) break;
    if (!selected.has(a) && !selected.has(b)) {
      result.push(a, b);
      selected.add(a);
      selected.add(b);
    }
  }

  // If still short, fill from pool. Prefer pulling a partner with the player if room allows
  for (const p of pool) {
    if (result.length >= 4) break;
    if (selected.has(p)) continue;

    const partner = partnerMap.get(p);
    if (
      partner &&
      inPool.has(partner) &&
      !selected.has(partner) &&
      result.length <= 2 // room for a pair
    ) {
      result.push(p, partner);
      selected.add(p);
      selected.add(partner);
      continue;
    }

    result.push(p);
    selected.add(p);
  }

  return result.slice(0, 4);
}

function evaluateMatchDeterministic(
  team1: [string, string],
  team2: [string, string],
  playerStats: Map<string, PlayerStats>,
  teammatePairs: TeammatePair[] = [],
  court: number = 1
): number {
  let score = 0;
  const [p1, p2] = team1;
  const [p3, p4] = team2;
  
  const stats1 = playerStats.get(p1)!;
  const stats2 = playerStats.get(p2)!;
  const stats3 = playerStats.get(p3)!;
  const stats4 = playerStats.get(p4)!;
  
  // 1. FAIRNESS - Heavily reward balanced play time (Primary factor)
  const playTimes = [stats1.playTime, stats2.playTime, stats3.playTime, stats4.playTime];
  const avgPlayTime = playTimes.reduce((a, b) => a + b, 0) / 4;
  const variance = playTimes.reduce((sum, time) => sum + Math.abs(time - avgPlayTime), 0);
  score -= variance * 10; // Increased weight for fairness
  
  // 1.5 COURT DISTRIBUTION - Penalize players who have played many games on this court recently
  const courtCounts = [
    stats1.matchesPerCourt.get(court) || 0,
    stats2.matchesPerCourt.get(court) || 0,
    stats3.matchesPerCourt.get(court) || 0,
    stats4.matchesPerCourt.get(court) || 0,
  ];
  const avgCourtCount = courtCounts.reduce((a, b) => a + b, 0) / 4;
  const courtVariance = courtCounts.reduce((sum, count) => sum + Math.abs(count - avgCourtCount), 0);
  score -= courtVariance * 8; // Penalize uneven court distribution
  
  // 2. BOUND PAIRS - Strong reward
  const isBoundPair1 = teammatePairs.some(pair => 
    (pair.player1 === p1 && pair.player2 === p2) || (pair.player1 === p2 && pair.player2 === p1)
  );
  const isBoundPair2 = teammatePairs.some(pair => 
    (pair.player1 === p3 && pair.player2 === p4) || (pair.player1 === p4 && pair.player2 === p3)
  );
  
  if (isBoundPair1) score += 1000;
  if (isBoundPair2) score += 1000;
  
  // 3. PARTNERSHIP VARIETY (unless bound)
  if (!isBoundPair1) {
    if (stats1.recentPartners[0] === p2) score -= 50;
    else if (stats1.recentPartners.includes(p2)) score -= 25;
  }
  if (!isBoundPair2) {
    if (stats3.recentPartners[0] === p4) score -= 50;
    else if (stats3.recentPartners.includes(p4)) score -= 25;
  }
  
  // 4. OPPONENT VARIETY
  if (stats1.recentOpponents.slice(0, 2).includes(p3)) score -= 30;
  if (stats1.recentOpponents.slice(0, 2).includes(p4)) score -= 30;
  if (stats2.recentOpponents.slice(0, 2).includes(p3)) score -= 30;
  if (stats2.recentOpponents.slice(0, 2).includes(p4)) score -= 30;
  
  // 5. DETERMINISTIC TIEBREAKER - Use player name hash for stable sorting
  const nameHash = (p1 + p2 + p3 + p4).split('').reduce((acc, char) => 
    acc + char.charCodeAt(0), 0
  );
  score += nameHash * 0.001; // Very small weight, only affects ties
  
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

  // Respect locked matches - only regenerate from first unlocked slot
  const lockedMatches = existingMatches.filter(m => m.isLocked);
  const unlockedMatches = existingMatches.filter(m => !m.isLocked);
  
  const firstUnlockedSlot = unlockedMatches.length > 0 
    ? Math.min(...unlockedMatches.map(m => m.startTime))
    : fromSlotStart;
  
  const regenerateFromSlot = Math.max(fromSlotStart, firstUnlockedSlot);
  const firstUnplayedSlot = Math.floor(regenerateFromSlot / gameDuration);
  const currentSlotStart = firstUnplayedSlot * gameDuration;
  const upNextSlotStart = (firstUnplayedSlot + 1) * gameDuration;
  
  // Check for conflicts in current and up next slots
  const preservedMatches: Match[] = [...lockedMatches];
  const slotsToCheck = [currentSlotStart, upNextSlotStart];
  
  for (const slotStart of slotsToCheck) {
    const matchesInSlot = existingMatches.filter(m => m.startTime === slotStart && !m.isLocked);
    const conflicts = detectCrossCourtConflicts(existingMatches, slotStart);
    
    if (conflicts.length === 0 && matchesInSlot.length > 0) {
      // No conflicts - preserve these matches as locked
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
  
  // Initialize player stats from ALL previous matches (played + locked + preserved)
  const playerStats = initializePlayerStats(players, courts);
  const rotationQueue = new PlayerRotationQueue(players, playerStats);
  const restQueue = new RestQueue();
  
  [...playedMatches, ...preservedMatches].forEach((match) => {
    [...match.team1, ...match.team2].forEach((player) => {
      updatePlayerStats(player, match, playerStats, gameDuration);
    });
  });
  
  // Generate remaining schedule with deterministic approach
  const totalSlots = 50; // Always pre-generate 50 games per court
  const preservedSlots = new Set(preservedMatches.map(m => m.startTime));
  const newMatches: Match[] = [...playedMatches, ...preservedMatches];
  const startSlot = Math.floor(regenerateFromSlot / gameDuration);
  
  // Convert existing matches to schedule format for conflict checking
  const schedule: ScheduleSlot[] = [];
  for (let s = 0; s < startSlot; s++) {
    const slotMatches = newMatches.filter(m => Math.floor(m.startTime / gameDuration) === s);
    schedule.push({ timeSlot: s, matches: slotMatches });
  }
  
  for (let slot = startSlot; slot < totalSlots; slot++) {
    const slotStartTime = slot * gameDuration;
    const slotEndTime = slotStartTime + gameDuration;
    
    if (preservedSlots.has(slotStartTime)) {
      const slotMatches = preservedMatches.filter(m => m.startTime === slotStartTime);
      schedule.push({ timeSlot: slot, matches: slotMatches });
      continue;
    }
    
    const playersUsedThisSlot = new Set<string>();
    const slotMatches: Match[] = [];
    
    restQueue.cleanup(slot);
    
    const courtOrder = slot % 2 === 0 ? finalCourtConfigs : [...finalCourtConfigs].reverse();
    for (const courtConfig of courtOrder) {
      const excludedPlayers = new Set([
        ...playersUsedThisSlot,
        ...getPreviousSlotPlayersOnOtherCourts(schedule, slot, courtConfig.courtNumber),
        ...getRestingPlayers(restQueue, slot, players)
      ]);
      
      const playersNeeded = courtConfig.type === 'singles' ? 2 : 4;
      let candidatePlayers = rotationQueue.getNextPlayers(playersNeeded * 3, excludedPlayers);
      
      // Filter by lookahead conflicts
      candidatePlayers = candidatePlayers.filter(p => 
        !wouldCreateFutureConflict(p, slot, courtConfig.courtNumber, schedule, gameDuration, 3)
      );
      
      if (candidatePlayers.length >= playersNeeded) {
        const match = createDeterministicMatch(
          candidatePlayers.slice(0, playersNeeded),
          playerStats,
          slotStartTime,
          slotEndTime,
          courtConfig.courtNumber,
          teammatePairs,
          courtConfig.type
        );
        
        if (match) {
          newMatches.push(match);
          slotMatches.push(match);
          
          const matchPlayers = [...match.team1, ...match.team2];
          matchPlayers.forEach(player => {
            playersUsedThisSlot.add(player);
            updatePlayerStats(player, match, playerStats, gameDuration);
            
            const stats = playerStats.get(player)!;
            if (stats.consecutiveMatches >= 2) {
              restQueue.addToRest(player, slot, stats.consecutiveMatches);
            }
          });
          
          rotationQueue.updateAfterMatch();
        }
      }
    }
    
    schedule.push({ timeSlot: slot, matches: slotMatches });
  }
  
  return finalizeMatches(newMatches, startTime, gameDuration);
}

// ==================== UTILITIES ====================

function finalizeMatches(matches: Match[], startTime?: string, gameDuration?: number): Match[] {
  // 1) Ensure each match has a stable, deterministic id
  const withIds = matches.map((m) => {
    const id = m.id && m.id.trim() !== "" ? m.id : `match-c${m.court}-t${m.startTime}`;
    return { ...m, id };
  });

  // 2) Remove duplicates by ID - keep the LAST occurrence (most recent)
  const seenIds = new Map<string, Match>();
  withIds.forEach((match) => {
    seenIds.set(match.id, match);
  });
  const uniqueMatches = Array.from(seenIds.values());
  
  // 3) Sort by court and startTime to maintain order
  uniqueMatches.sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return a.court - b.court;
  });
  
  // 4) Lock and compute display times
  return uniqueMatches.map((match) => {
    const finalMatch: Match = { 
      ...match,
      isLocked: match.isLocked !== false // Lock by default unless explicitly unlocked
    };
    
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
