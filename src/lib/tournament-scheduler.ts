import { Match, CourtConfig } from './scheduler';

export interface TournamentPlayer {
  name: string;
  seed: number;
}

/**
 * Generate a single elimination tournament bracket
 */
export function generateSingleEliminationBracket(
  players: string[],
  courts: number,
  gameDuration: number,
  courtConfigs: CourtConfig[],
  thirdPlaceMatch: boolean = false
): Match[] {
  const seededPlayers = seedPlayers(players, 'random');
  const bracketSize = getNextPowerOfTwo(players.length);
  const byeCount = bracketSize - players.length;
  
  // Pad with byes if needed
  const paddedPlayers: (TournamentPlayer | null)[] = [...seededPlayers];
  for (let i = 0; i < byeCount; i++) {
    paddedPlayers.push(null);
  }
  
  const matches: Match[] = [];
  const totalRounds = Math.log2(bracketSize);
  let matchIdCounter = 0;
  
  // Generate bracket round by round
  let currentRoundPlayers = paddedPlayers;
  let timeOffset = 0;
  
  for (let round = 1; round <= totalRounds; round++) {
    const roundName = getRoundName(round, totalRounds);
    const matchesInRound = currentRoundPlayers.length / 2;
    const nextRoundPlayers: (TournamentPlayer | null)[] = [];
    
    for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
      const player1 = currentRoundPlayers[matchNum * 2];
      const player2 = currentRoundPlayers[matchNum * 2 + 1];
      
      // Determine court assignment (distribute across courts)
      const court = (matchNum % courts) + 1;
      const courtConfig = courtConfigs.find(c => c.courtNumber === court) || courtConfigs[0];
      
      // Calculate time slot - matches on same court must be sequential
      const courtMatchIndex = Math.floor(matchNum / courts);
      const startTime = timeOffset + (courtMatchIndex * gameDuration);
      const endTime = startTime + gameDuration;
      
      const matchId = `tournament-r${round}-m${matchNum + 1}`;
      const nextMatchId = round < totalRounds ? `tournament-r${round + 1}-m${Math.floor(matchNum / 2) + 1}` : undefined;
      
      // Handle byes - if one player is null, the other advances automatically
      let team1: [string] | ['TBD'];
      let team2: [string] | ['TBD'];
      
      if (player1 && !player2) {
        // Player 1 gets a bye - advance directly, don't create match
        nextRoundPlayers.push(player1);
        continue; // Skip creating this match
      } else if (player2 && !player1) {
        // Player 2 gets a bye - advance directly, don't create match
        nextRoundPlayers.push(player2);
        continue; // Skip creating this match
      } else if (player1 && player2) {
        team1 = [player1.name];
        team2 = [player2.name];
        nextRoundPlayers.push(null); // Winner TBD
      } else {
        // Both are byes - skip this match entirely
        nextRoundPlayers.push(null);
        continue;
      }
      
      const match: Match = {
        id: matchId,
        court,
        startTime,
        endTime,
        team1,
        team2,
        status: 'scheduled',
        isSingles: courtConfig.type === 'singles',
        isLocked: false,
        tournamentMetadata: {
          bracketType: round === totalRounds ? 'finals' : 'winners',
          round,
          roundName,
          matchNumber: matchNum + 1,
          advancesTo: nextMatchId,
          seed1: player1?.seed,
          seed2: player2?.seed,
        }
      };
      
      matches.push(match);
      matchIdCounter++;
    }
    
    // Move to next round
    currentRoundPlayers = nextRoundPlayers;
    
    // Add time offset for next round (all matches in this round must complete first)
    const maxMatchesOnAnyCourt = Math.ceil(matchesInRound / courts);
    timeOffset += maxMatchesOnAnyCourt * gameDuration;
  }
  
  // Add third place match if requested
  if (thirdPlaceMatch && totalRounds >= 2) {
    const semiFinalsIds = matches
      .filter(m => m.tournamentMetadata?.round === totalRounds - 1)
      .map(m => m.id);
    
    const thirdPlaceMatchId = 'tournament-third-place';
    const thirdPlaceStart = timeOffset;
    const thirdPlaceEnd = thirdPlaceStart + gameDuration;
    
    matches.push({
      id: thirdPlaceMatchId,
      court: 1,
      startTime: thirdPlaceStart,
      endTime: thirdPlaceEnd,
      team1: ['TBD'],
      team2: ['TBD'],
      status: 'scheduled',
      isSingles: courtConfigs[0].type === 'singles',
      isLocked: false,
      tournamentMetadata: {
        bracketType: 'third-place',
        round: totalRounds,
        roundName: '3rd Place Match',
        matchNumber: 1,
        sourceMatch1: semiFinalsIds[0],
        sourceMatch2: semiFinalsIds[1],
      }
    });
  }
  
  return matches;
}

/**
 * Generate a double elimination tournament bracket
 */
export function generateDoubleEliminationBracket(
  players: string[],
  courts: number,
  gameDuration: number,
  courtConfigs: CourtConfig[]
): Match[] {
  const seededPlayers = seedPlayers(players, 'random');
  const bracketSize = getNextPowerOfTwo(players.length);
  const byeCount = bracketSize - players.length;
  
  // Pad with byes
  const paddedPlayers: (TournamentPlayer | null)[] = [...seededPlayers];
  for (let i = 0; i < byeCount; i++) {
    paddedPlayers.push(null);
  }
  
  const matches: Match[] = [];
  const winnersRounds = Math.log2(bracketSize);
  const losersRounds = (winnersRounds - 1) * 2;
  
  let timeOffset = 0;
  
  // Generate Winner's Bracket
  let currentWinnerPlayers = paddedPlayers;
  
  for (let round = 1; round <= winnersRounds; round++) {
    const roundName = `Winners ${getRoundName(round, winnersRounds)}`;
    const matchesInRound = currentWinnerPlayers.length / 2;
    const nextRoundPlayers: (TournamentPlayer | null)[] = [];
    
    for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
      const player1 = currentWinnerPlayers[matchNum * 2];
      const player2 = currentWinnerPlayers[matchNum * 2 + 1];
      
      const court = (matchNum % courts) + 1;
      const courtConfig = courtConfigs.find(c => c.courtNumber === court) || courtConfigs[0];
      const courtMatchIndex = Math.floor(matchNum / courts);
      const startTime = timeOffset + (courtMatchIndex * gameDuration);
      const endTime = startTime + gameDuration;
      
      const matchId = `tournament-wb-r${round}-m${matchNum + 1}`;
      const nextWinnersMatchId = round < winnersRounds ? `tournament-wb-r${round + 1}-m${Math.floor(matchNum / 2) + 1}` : 'tournament-grand-finals';
      
      // Determine where loser goes in loser's bracket
      const loserRound = round === 1 ? 1 : ((round - 1) * 2);
      const losersMatchId = round < winnersRounds ? `tournament-lb-r${loserRound}-m${matchNum + 1}` : 'tournament-lb-finals';
      
      let team1: [string] | ['TBD'];
      let team2: [string] | ['TBD'];
      
      if (player1 && !player2) {
        // Player 1 gets a bye - advance directly
        nextRoundPlayers.push(player1);
        continue;
      } else if (player2 && !player1) {
        // Player 2 gets a bye - advance directly
        nextRoundPlayers.push(player2);
        continue;
      } else if (player1 && player2) {
        team1 = [player1.name];
        team2 = [player2.name];
        nextRoundPlayers.push(null);
      } else {
        // Both are byes - skip
        nextRoundPlayers.push(null);
        continue;
      }
      
      matches.push({
        id: matchId,
        court,
        startTime,
        endTime,
        team1,
        team2,
        status: 'scheduled',
        isSingles: courtConfig.type === 'singles',
        isLocked: false,
        tournamentMetadata: {
          bracketType: 'winners',
          round,
          roundName,
          matchNumber: matchNum + 1,
          advancesTo: nextWinnersMatchId,
          loserAdvancesTo: losersMatchId,
          seed1: player1?.seed,
          seed2: player2?.seed,
        }
      });
    }
    
    currentWinnerPlayers = nextRoundPlayers;
    const maxMatchesOnAnyCourt = Math.ceil(matchesInRound / courts);
    timeOffset += maxMatchesOnAnyCourt * gameDuration;
  }
  
  // Generate Loser's Bracket (simplified - single round for now)
  const losersBracketStart = timeOffset;
  matches.push({
    id: 'tournament-lb-finals',
    court: 1,
    startTime: losersBracketStart,
    endTime: losersBracketStart + gameDuration,
    team1: ['TBD'],
    team2: ['TBD'],
    status: 'scheduled',
    isSingles: courtConfigs[0].type === 'singles',
    isLocked: false,
    tournamentMetadata: {
      bracketType: 'losers',
      round: 1,
      roundName: "Loser's Finals",
      matchNumber: 1,
      advancesTo: 'tournament-grand-finals',
    }
  });
  
  timeOffset += gameDuration;
  
  // Grand Finals
  matches.push({
    id: 'tournament-grand-finals',
    court: 1,
    startTime: timeOffset,
    endTime: timeOffset + gameDuration,
    team1: ['TBD'],
    team2: ['TBD'],
    status: 'scheduled',
    isSingles: courtConfigs[0].type === 'singles',
    isLocked: false,
    tournamentMetadata: {
      bracketType: 'grand-finals',
      round: winnersRounds + 1,
      roundName: 'Grand Finals',
      matchNumber: 1,
    }
  });
  
  return matches;
}

/**
 * Seed players for tournament
 */
export function seedPlayers(players: string[], seedingType: 'random' | 'manual'): TournamentPlayer[] {
  if (seedingType === 'random') {
    // Random seeding - shuffle players
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    return shuffled.map((name, index) => ({ name, seed: index + 1 }));
  }
  
  // Manual seeding - use order provided
  return players.map((name, index) => ({ name, seed: index + 1 }));
}

/**
 * Get next power of 2 greater than or equal to n
 */
function getNextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
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
