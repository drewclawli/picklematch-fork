import { Match } from './scheduler';

/**
 * Advance winner to next match in tournament bracket
 */
export function advanceWinnerToNextMatch(
  completedMatch: Match,
  winner: 'team1' | 'team2',
  allMatches: Match[]
): Match[] {
  if (!completedMatch.tournamentMetadata) {
    return allMatches;
  }
  
  const { advancesTo, loserAdvancesTo, bracketType } = completedMatch.tournamentMetadata;
  const winnerName = winner === 'team1' ? completedMatch.team1[0] : completedMatch.team2[0];
  const loserName = winner === 'team1' ? completedMatch.team2[0] : completedMatch.team1[0];
  
  // Mark completed match as completed
  let updatedMatches = allMatches.map(m => 
    m.id === completedMatch.id 
      ? { ...m, status: 'completed' as Match['status'] }
      : m
  );
  
  // Advance winner to next match
  if (advancesTo) {
    updatedMatches = updatedMatches.map(match => {
      if (match.id === advancesTo) {
        // Determine which slot to place winner in based on match number
        // Odd match numbers (1, 3, 5...) advance to team1 slot
        // Even match numbers (2, 4, 6...) advance to team2 slot
        const isFirstSlot = completedMatch.tournamentMetadata?.matchNumber! % 2 === 1;
        
        if (isFirstSlot) {
          const newTeam2 = match.team2[0] !== 'TBD' ? match.team2 : match.team2;
          return {
            ...match,
            team1: [winnerName] as [string],
            status: (newTeam2[0] !== 'TBD' ? 'scheduled' : 'scheduled') as Match['status']
          };
        } else {
          const newTeam1 = match.team1[0] !== 'TBD' ? match.team1 : match.team1;
          return {
            ...match,
            team2: [winnerName] as [string],
            status: (newTeam1[0] !== 'TBD' ? 'scheduled' : 'scheduled') as Match['status']
          };
        }
      }
      return match;
    });
  }
  
  // Advance loser to loser's bracket (double elimination only)
  if (loserAdvancesTo && bracketType === 'winners') {
    updatedMatches = updatedMatches.map(match => {
      if (match.id === loserAdvancesTo) {
        const isFirstSlot = completedMatch.tournamentMetadata?.matchNumber! % 2 === 1;
        
        if (isFirstSlot && match.team1[0] === 'TBD') {
          return {
            ...match,
            team1: [loserName] as [string],
            status: (match.team2[0] !== 'TBD' ? 'scheduled' : match.status) as Match['status']
          };
        } else if (!isFirstSlot && match.team2[0] === 'TBD') {
          return {
            ...match,
            team2: [loserName] as [string],
            status: (match.team1[0] !== 'TBD' ? 'scheduled' : match.status) as Match['status']
          };
        } else if (match.team1[0] === 'TBD') {
          return {
            ...match,
            team1: [loserName] as [string],
            status: (match.team2[0] !== 'TBD' ? 'scheduled' : match.status) as Match['status']
          };
        } else if (match.team2[0] === 'TBD') {
          return {
            ...match,
            team2: [loserName] as [string],
            status: (match.team1[0] !== 'TBD' ? 'scheduled' : match.status) as Match['status']
          };
        }
      }
      return match;
    });
  }
  
  // Handle third place match - advance losers from semifinals
  const thirdPlaceMatch = allMatches.find(m => m.tournamentMetadata?.bracketType === 'third-place');
  if (thirdPlaceMatch && bracketType === 'winners') {
    const metadata = thirdPlaceMatch.tournamentMetadata;
    if (metadata?.sourceMatch1 === completedMatch.id || metadata?.sourceMatch2 === completedMatch.id) {
      updatedMatches = updatedMatches.map(match => {
        if (match.id === thirdPlaceMatch.id) {
          if (metadata.sourceMatch1 === completedMatch.id && match.team1[0] === 'TBD') {
            return {
              ...match,
              team1: [loserName] as [string],
              status: (match.team2[0] !== 'TBD' ? 'scheduled' : match.status) as Match['status']
            };
          } else if (metadata.sourceMatch2 === completedMatch.id && match.team2[0] === 'TBD') {
            return {
              ...match,
              team2: [loserName] as [string],
              status: (match.team1[0] !== 'TBD' ? 'scheduled' : match.status) as Match['status']
            };
          }
        }
        return match;
      });
    }
  }
  
  return updatedMatches;
}

/**
 * Determine tournament winner from matches
 */
export function determineTournamentWinner(matches: Match[]): string | null {
  const finalsMatch = matches.find(m => 
    m.tournamentMetadata?.bracketType === 'finals' || 
    m.tournamentMetadata?.bracketType === 'grand-finals'
  );
  
  if (!finalsMatch || !finalsMatch.score) {
    return null;
  }
  
  const { team1, team2 } = finalsMatch.score;
  return team1 > team2 ? finalsMatch.team1[0] : finalsMatch.team2[0];
}

/**
 * Calculate tournament standings based on match results
 */
export function calculateTournamentStandings(matches: Match[], players: string[]): {
  player: string;
  placement: number;
  roundsWon: number;
  wins: number;
  losses: number;
}[] {
  const playerStats = players.map(player => {
    let wins = 0;
    let losses = 0;
    let lastRound = 0;
    
    matches.forEach(match => {
      if (!match.score || match.team1[0] === 'TBD' || match.team2[0] === 'TBD') return;
      
      const isTeam1 = match.team1[0] === player;
      const isTeam2 = match.team2[0] === player;
      
      if (!isTeam1 && !isTeam2) return;
      
      const team1Score = match.score.team1;
      const team2Score = match.score.team2;
      const round = match.tournamentMetadata?.round || 0;
      
      if (isTeam1) {
        if (team1Score > team2Score) {
          wins++;
          lastRound = Math.max(lastRound, round);
        } else {
          losses++;
        }
      } else if (isTeam2) {
        if (team2Score > team1Score) {
          wins++;
          lastRound = Math.max(lastRound, round);
        } else {
          losses++;
        }
      }
    });
    
    // Calculate placement based on rounds won (how far they got)
    let placement = 1;
    if (lastRound === 0) {
      placement = players.length; // Didn't win any matches
    } else {
      // Approximate placement based on rounds won
      const totalRounds = Math.max(...matches.map(m => m.tournamentMetadata?.round || 0));
      placement = Math.pow(2, totalRounds - lastRound);
    }
    
    return {
      player,
      placement,
      roundsWon: lastRound,
      wins,
      losses
    };
  });
  
  // Sort by placement, then by wins
  return playerStats.sort((a, b) => {
    if (a.placement !== b.placement) return a.placement - b.placement;
    return b.wins - a.wins;
  });
}
