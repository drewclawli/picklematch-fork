import { Match, CourtConfig, TournamentMetadata } from './scheduler';

/**
 * Generate a complete tournament schedule (single or double elimination)
 */
export function generateTournamentSchedule(
  players: string[],
  gameDuration: number,
  courts: number,
  schedulingType: 'single-elimination' | 'double-elimination',
  courtConfigs: CourtConfig[],
  teammatePairs: Array<{ player1: string; player2: string }> = [],
  isSingles: boolean = false
): Match[] {
  // For doubles tournaments, validate we have teams (pairs)
  if (!isSingles) {
    // Convert players to teams (pairs)
    const teams = createTeamsFromPlayers(players, teammatePairs);
    
    // Validate team count (4-16 teams)
    if (teams.length < 4 || teams.length > 16) {
      throw new Error('Tournament requires 4-16 teams (pairs)');
    }

    if (schedulingType === 'single-elimination') {
      return generateSingleEliminationBracket(teams, gameDuration, courts, courtConfigs, false);
    } else {
      return generateDoubleEliminationBracket(teams, gameDuration, courts, courtConfigs, false);
    }
  }

  // For singles tournaments, validate player count
  if (players.length < 4 || players.length > 16) {
    throw new Error('Tournament requires 4-16 players');
  }

  if (schedulingType === 'single-elimination') {
    return generateSingleEliminationBracket(players.map(p => [p]), gameDuration, courts, courtConfigs, true);
  } else {
    return generateDoubleEliminationBracket(players.map(p => [p]), gameDuration, courts, courtConfigs, true);
  }
}

/**
 * Create teams from players and pairs
 * Unpaired players will be randomly paired
 * For doubles, ensures all teams have exactly 2 players
 */
function createTeamsFromPlayers(
  players: string[],
  teammatePairs: Array<{ player1: string; player2: string }>
): string[][] {
  const teams: string[][] = [];
  const pairedPlayers = new Set<string>();
  
  // Add existing pairs as teams
  teammatePairs.forEach(pair => {
    if (players.includes(pair.player1) && players.includes(pair.player2)) {
      teams.push([pair.player1, pair.player2]);
      pairedPlayers.add(pair.player1);
      pairedPlayers.add(pair.player2);
    }
  });
  
  // Collect unpaired players
  const unpairedPlayers = players.filter(p => !pairedPlayers.has(p));
  
  // Randomly pair unpaired players
  const shuffled = [...unpairedPlayers].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      teams.push([shuffled[i], shuffled[i + 1]]);
    } else {
      // Odd player out - pair with themselves (will need a substitute)
      // In a real tournament, this would be flagged for organizer attention
      teams.push([shuffled[i], shuffled[i]]);
    }
  }
  
  return teams;
}

/**
 * Generate single elimination bracket
 */
function generateSingleEliminationBracket(
  teams: string[][],
  gameDuration: number,
  courts: number,
  courtConfigs: CourtConfig[],
  isSingles: boolean
): Match[] {
  const bracketSize = calculateBracketSize(teams.length);
  const seededTeams = seedPlayers(teams, bracketSize);
  const structure = createSingleEliminationStructure(bracketSize, gameDuration, courts, courtConfigs, isSingles);
  
  return assignInitialPlayers(structure, seededTeams);
}

/**
 * Generate double elimination bracket
 */
function generateDoubleEliminationBracket(
  teams: string[][],
  gameDuration: number,
  courts: number,
  courtConfigs: CourtConfig[],
  isSingles: boolean
): Match[] {
  const bracketSize = calculateBracketSize(teams.length);
  const seededTeams = seedPlayers(teams, bracketSize);
  const structure = createDoubleEliminationStructure(bracketSize, gameDuration, courts, courtConfigs, isSingles);
  
  return assignInitialPlayers(structure, seededTeams);
}

/**
 * Calculate bracket size (next power of 2: 4, 8, or 16)
 */
function calculateBracketSize(playerCount: number): number {
  if (playerCount <= 4) return 4;
  if (playerCount <= 8) return 8;
  return 16;
}

/**
 * Seed players/teams (1, 2, 3... with byes if needed)
 */
function seedPlayers(teams: string[][], bracketSize: number): Array<string[] | null> {
  const seeded: Array<string[] | null> = new Array(bracketSize).fill(null);
  
  // Standard bracket seeding order (1 vs 16, 8 vs 9, etc.)
  const seedOrder = generateSeedOrder(bracketSize);
  
  for (let i = 0; i < teams.length; i++) {
    seeded[seedOrder[i]] = teams[i];
  }
  
  return seeded;
}

/**
 * Generate standard bracket seed order
 */
function generateSeedOrder(size: number): number[] {
  if (size === 4) return [0, 3, 1, 2];
  if (size === 8) return [0, 7, 3, 4, 1, 6, 2, 5];
  // size === 16
  return [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10];
}

/**
 * Create single elimination bracket structure
 */
function createSingleEliminationStructure(
  bracketSize: number,
  gameDuration: number,
  courts: number,
  courtConfigs: CourtConfig[],
  isSingles: boolean
): Match[] {
  const matches: Match[] = [];
  const rounds = Math.log2(bracketSize);
  
  let matchIdCounter = 0;
  let currentTime = 0;
  let currentCourt = 0;
  
  // Generate matches for each round
  for (let round = 1; round <= rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round);
    const roundName = getRoundName(round, rounds);
    
    for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
      const matchId = `tournament-r${round}-m${matchNum + 1}`;
      const courtConfig = courtConfigs[currentCourt % courtConfigs.length];
      
      const metadata: TournamentMetadata = {
        bracketType: 'winners',
        round,
        roundName,
        matchNumber: matchNum + 1,
        bracketPosition: round === 1 ? String.fromCharCode(65 + matchNum) : undefined,
        seed1: round === 1 ? matchNum * 2 + 1 : undefined,
        seed2: round === 1 ? matchNum * 2 + 2 : undefined,
      };
      
      // Set advancement metadata
      if (round < rounds) {
        const nextMatchNum = Math.floor(matchNum / 2);
        metadata.advancesTo = `tournament-r${round + 1}-m${nextMatchNum + 1}`;
        metadata.advancesToSlot = matchNum % 2 === 0 ? 'team1' : 'team2';
      }
      
      // Set source matches for rounds after the first
      if (round > 1) {
        const prevMatch1 = matchNum * 2;
        const prevMatch2 = matchNum * 2 + 1;
        metadata.sourceMatch1 = `tournament-r${round - 1}-m${prevMatch1 + 1}`;
        metadata.sourceMatch2 = `tournament-r${round - 1}-m${prevMatch2 + 1}`;
      }
      
      matches.push({
        id: matchId,
        court: courtConfig.courtNumber,
        startTime: currentTime,
        endTime: currentTime + gameDuration,
        team1: isSingles ? ['TBD'] as [string] : ['TBD', 'TBD'] as [string, string],
        team2: isSingles ? ['TBD'] as [string] : ['TBD', 'TBD'] as [string, string],
        status: round === 1 ? 'scheduled' : 'waiting',
        isSingles: isSingles,
        isLocked: false,
        tournamentMetadata: metadata,
      });
      
      currentCourt++;
      matchIdCounter++;
      
      // Move to next time slot when all courts are used
      if (currentCourt % courts === 0) {
        currentTime += gameDuration;
      }
    }
    
    // Ensure next round starts at a new time slot
    if (currentCourt % courts !== 0) {
      currentTime += gameDuration;
      currentCourt = 0;
    }
  }
  
  return matches;
}

/**
 * Create double elimination bracket structure
 */
function createDoubleEliminationStructure(
  bracketSize: number,
  gameDuration: number,
  courts: number,
  courtConfigs: CourtConfig[],
  isSingles: boolean
): Match[] {
  const winnersMatches: Match[] = [];
  const losersMatches: Match[] = [];
  const rounds = Math.log2(bracketSize);
  
  let currentTime = 0;
  let currentCourt = 0;
  
  // Generate winners bracket
  for (let round = 1; round <= rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round);
    const roundName = getRoundName(round, rounds);
    
    for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
      const matchId = `tournament-w-r${round}-m${matchNum + 1}`;
      const courtConfig = courtConfigs[currentCourt % courtConfigs.length];
      
      const metadata: TournamentMetadata = {
        bracketType: 'winners',
        round,
        roundName: `Winners ${roundName}`,
        matchNumber: matchNum + 1,
        bracketPosition: round === 1 ? String.fromCharCode(65 + matchNum) : undefined,
        seed1: round === 1 ? matchNum * 2 + 1 : undefined,
        seed2: round === 1 ? matchNum * 2 + 2 : undefined,
      };
      
      // Set advancement for winners
      if (round < rounds) {
        const nextMatchNum = Math.floor(matchNum / 2);
        metadata.advancesTo = `tournament-w-r${round + 1}-m${nextMatchNum + 1}`;
        metadata.advancesToSlot = matchNum % 2 === 0 ? 'team1' : 'team2';
      } else {
        // Winners bracket final goes to grand finals
        metadata.advancesTo = 'tournament-grand-finals';
        metadata.advancesToSlot = 'team1';
      }
      
      // Set loser advancement to losers bracket
      const loserRound = (round - 1) * 2 + 1;
      if (round === 1) {
        metadata.loserAdvancesTo = `tournament-l-r1-m${matchNum + 1}`;
        metadata.loserAdvancesToSlot = 'team1';
      } else if (round < rounds) {
        const loserMatchNum = Math.floor(matchNum / 2);
        metadata.loserAdvancesTo = `tournament-l-r${loserRound}-m${loserMatchNum + 1}`;
        metadata.loserAdvancesToSlot = matchNum % 2 === 0 ? 'team1' : 'team2';
      } else {
        // Loser of winners finals goes to losers finals
        metadata.loserAdvancesTo = 'tournament-losers-finals';
        metadata.loserAdvancesToSlot = 'team2';
      }
      
      // Set source matches
      if (round > 1) {
        metadata.sourceMatch1 = `tournament-w-r${round - 1}-m${matchNum * 2 + 1}`;
        metadata.sourceMatch2 = `tournament-w-r${round - 1}-m${matchNum * 2 + 2}`;
      }
      
      winnersMatches.push({
        id: matchId,
        court: courtConfig.courtNumber,
        startTime: currentTime,
        endTime: currentTime + gameDuration,
        team1: isSingles ? ['TBD'] as [string] : ['TBD', 'TBD'] as [string, string],
        team2: isSingles ? ['TBD'] as [string] : ['TBD', 'TBD'] as [string, string],
        status: round === 1 ? 'scheduled' : 'waiting',
        isSingles: isSingles,
        isLocked: false,
        tournamentMetadata: metadata,
      });
      
      currentCourt++;
      if (currentCourt % courts === 0) {
        currentTime += gameDuration;
      }
    }
    
    if (currentCourt % courts !== 0) {
      currentTime += gameDuration;
      currentCourt = 0;
    }
  }
  
  // Generate losers bracket (simplified - 2 * (rounds - 1) rounds)
  const loserRounds = 2 * (rounds - 1);
  for (let round = 1; round <= loserRounds; round++) {
    const matchesInRound = round % 2 === 1 
      ? Math.pow(2, rounds - Math.ceil(round / 2) - 1)
      : Math.pow(2, rounds - Math.ceil(round / 2) - 1);
    
    for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
      const matchId = `tournament-l-r${round}-m${matchNum + 1}`;
      const courtConfig = courtConfigs[currentCourt % courtConfigs.length];
      
      const metadata: TournamentMetadata = {
        bracketType: 'losers',
        round,
        roundName: `Losers R${round}`,
        matchNumber: matchNum + 1,
      };
      
      // Set advancement
      if (round < loserRounds) {
        const nextMatchNum = round % 2 === 1 ? matchNum : Math.floor(matchNum / 2);
        metadata.advancesTo = `tournament-l-r${round + 1}-m${nextMatchNum + 1}`;
        metadata.advancesToSlot = round % 2 === 0 && matchNum % 2 === 1 ? 'team2' : 'team1';
      } else {
        // Losers bracket final goes to grand finals
        metadata.advancesTo = 'tournament-losers-finals';
        metadata.advancesToSlot = 'team1';
      }
      
      losersMatches.push({
        id: matchId,
        court: courtConfig.courtNumber,
        startTime: currentTime,
        endTime: currentTime + gameDuration,
        team1: isSingles ? ['TBD'] as [string] : ['TBD', 'TBD'] as [string, string],
        team2: isSingles ? ['TBD'] as [string] : ['TBD', 'TBD'] as [string, string],
        status: 'waiting',
        isSingles: isSingles,
        isLocked: false,
        tournamentMetadata: metadata,
      });
      
      currentCourt++;
      if (currentCourt % courts === 0) {
        currentTime += gameDuration;
      }
    }
    
    if (currentCourt % courts !== 0) {
      currentTime += gameDuration;
      currentCourt = 0;
    }
  }
  
  // Add losers finals
  const courtConfig = courtConfigs[0];
  losersMatches.push({
    id: 'tournament-losers-finals',
    court: courtConfig.courtNumber,
    startTime: currentTime,
    endTime: currentTime + gameDuration,
    team1: isSingles ? ['TBD'] as [string] : ['TBD', 'TBD'] as [string, string],
    team2: isSingles ? ['TBD'] as [string] : ['TBD', 'TBD'] as [string, string],
    status: 'waiting',
    isSingles: isSingles,
    isLocked: false,
    tournamentMetadata: {
      bracketType: 'finals',
      round: loserRounds + 1,
      roundName: 'Losers Finals',
      matchNumber: 1,
      advancesTo: 'tournament-grand-finals',
      advancesToSlot: 'team2',
    },
  });
  
  currentTime += gameDuration;
  
  // Add grand finals
  losersMatches.push({
    id: 'tournament-grand-finals',
    court: courtConfig.courtNumber,
    startTime: currentTime,
    endTime: currentTime + gameDuration,
    team1: isSingles ? ['TBD'] as [string] : ['TBD', 'TBD'] as [string, string],
    team2: isSingles ? ['TBD'] as [string] : ['TBD', 'TBD'] as [string, string],
    status: 'waiting',
    isSingles: isSingles,
    isLocked: false,
    tournamentMetadata: {
      bracketType: 'grand-finals',
      round: loserRounds + 2,
      roundName: 'Grand Finals',
      matchNumber: 1,
    },
  });
  
  return [...winnersMatches, ...losersMatches];
}

/**
 * Assign initial players to Round 1 matches
 */
function assignInitialPlayers(matches: Match[], seededTeams: Array<string[] | null>): Match[] {
  return matches.map(match => {
    if (match.tournamentMetadata?.round === 1) {
      const seed1 = match.tournamentMetadata.seed1;
      const seed2 = match.tournamentMetadata.seed2;
      
      if (seed1 !== undefined && seed2 !== undefined) {
        const team1 = seededTeams[seed1 - 1];
        const team2 = seededTeams[seed2 - 1];
        
        // Handle byes
        if (!team1 && !team2) {
          return { ...match, status: 'bye' as const };
        } else if (!team1) {
          // Team 2 gets a bye
          return {
            ...match,
            team1: match.isSingles ? [team2![0]] as [string] : [team2![0], team2![1] || team2![0]] as [string, string],
            team2: match.isSingles ? [team2![0]] as [string] : [team2![0], team2![1] || team2![0]] as [string, string],
            status: 'bye' as const,
          };
        } else if (!team2) {
          // Team 1 gets a bye
          return {
            ...match,
            team1: match.isSingles ? [team1[0]] as [string] : [team1[0], team1[1] || team1[0]] as [string, string],
            team2: match.isSingles ? [team1[0]] as [string] : [team1[0], team1[1] || team1[0]] as [string, string],
            status: 'bye' as const,
          };
        } else {
          // Normal match
          return {
            ...match,
            team1: match.isSingles ? [team1[0]] as [string] : [team1[0], team1[1] || team1[0]] as [string, string],
            team2: match.isSingles ? [team2[0]] as [string] : [team2[0], team2[1] || team2[0]] as [string, string],
            status: 'scheduled' as const,
          };
        }
      }
    }
    return match;
  });
}

/**
 * Get round name based on round number and total rounds
 */
function getRoundName(round: number, totalRounds: number): string {
  const remaining = totalRounds - round;
  
  if (remaining === 0) return 'Finals';
  if (remaining === 1) return 'Semifinals';
  if (remaining === 2) return 'Quarterfinals';
  if (remaining === 3) return 'Round of 16';
  
  return `Round ${round}`;
}
