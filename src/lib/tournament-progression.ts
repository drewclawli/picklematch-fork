import { Match } from './scheduler';

/**
 * Advance winner to next match after a tournament match is completed
 */
export function advanceWinnerToNextMatch(
  completedMatch: Match,
  winner: 'team1' | 'team2',
  allMatches: Match[]
): Match[] {
  if (!completedMatch.tournamentMetadata) {
    return allMatches;
  }

  // Get the full winning team (both players for doubles)
  const winningTeam = completedMatch[winner];
  const losingTeam = winner === 'team1' ? completedMatch.team2 : completedMatch.team1;
  const metadata = completedMatch.tournamentMetadata;
  const isSingles = completedMatch.isSingles;

  let updatedMatches = [...allMatches];

  // Advance winner to next match
  if (metadata.advancesTo && metadata.advancesToSlot) {
    updatedMatches = updatedMatches.map(match => {
      if (match.id === metadata.advancesTo) {
        const newMatch = {
          ...match,
          [metadata.advancesToSlot!]: isSingles 
            ? [winningTeam[0]] as [string]
            : [winningTeam[0], winningTeam[1] || winningTeam[0]] as [string, string],
        };

        // Check if both slots are filled to update status
        if (newMatch.team1[0] !== 'TBD' && newMatch.team2[0] !== 'TBD') {
          newMatch.status = 'scheduled' as const;
        }

        return newMatch;
      }
      return match;
    });
  }

  // Advance loser to losers bracket (for double elimination)
  if (metadata.loserAdvancesTo && metadata.loserAdvancesToSlot) {
    updatedMatches = updatedMatches.map(match => {
      if (match.id === metadata.loserAdvancesTo) {
        const newMatch = {
          ...match,
          [metadata.loserAdvancesToSlot!]: isSingles
            ? [losingTeam[0]] as [string]
            : [losingTeam[0], losingTeam[1] || losingTeam[0]] as [string, string],
        };

        // Check if both slots are filled to update status
        if (newMatch.team1[0] !== 'TBD' && newMatch.team2[0] !== 'TBD') {
          newMatch.status = 'scheduled' as const;
        }

        return newMatch;
      }
      return match;
    });
  }

  // Mark completed match
  updatedMatches = updatedMatches.map(match => {
    if (match.id === completedMatch.id) {
      return {
        ...match,
        status: 'completed' as const,
      };
    }
    return match;
  });

  // Handle bye matches - auto-advance
  updatedMatches = updatedMatches.map(match => {
    if (match.status === 'bye' && match.tournamentMetadata) {
      const byeWinner = match.team1[0];
      const byeMetadata = match.tournamentMetadata;

      if (byeMetadata.advancesTo && byeMetadata.advancesToSlot) {
        // Find and update the next match
        return match;
      }
    }
    return match;
  });

  return updatedMatches;
}

/**
 * Process all bye matches and auto-advance players
 */
export function processByeMatches(matches: Match[]): Match[] {
  let updatedMatches = [...matches];
  let hasChanges = true;

  // Loop until no more byes to process
  while (hasChanges) {
    hasChanges = false;

    updatedMatches = updatedMatches.map(match => {
      if (match.status === 'bye' && match.tournamentMetadata) {
        const byeWinningTeam = match.team1;
        const metadata = match.tournamentMetadata;

        if (metadata.advancesTo && metadata.advancesToSlot && byeWinningTeam[0] !== 'TBD') {
          // Mark this bye as completed
          hasChanges = true;
          return {
            ...match,
            status: 'completed' as const,
            score: { team1: 0, team2: 0 },
          };
        }
      }
      return match;
    });

    // Advance bye winners
    updatedMatches = updatedMatches.map(match => {
      const byeMatches = updatedMatches.filter(m => 
        m.status === 'completed' && 
        m.tournamentMetadata?.advancesTo === match.id
      );

      if (byeMatches.length > 0) {
        let newMatch = { ...match };

        byeMatches.forEach(byeMatch => {
          if (byeMatch.tournamentMetadata) {
            const byeWinningTeam = byeMatch.team1;
            const slot = byeMatch.tournamentMetadata.advancesToSlot;
            const isSingles = byeMatch.isSingles;

            if (slot && byeWinningTeam[0] !== 'TBD') {
              newMatch = {
                ...newMatch,
                [slot]: isSingles
                  ? [byeWinningTeam[0]] as [string]
                  : [byeWinningTeam[0], byeWinningTeam[1] || byeWinningTeam[0]] as [string, string],
              };
            }
          }
        });

        // Update status if both slots filled
        if (newMatch.team1[0] !== 'TBD' && newMatch.team2[0] !== 'TBD') {
          newMatch.status = 'scheduled' as const;
        }

        return newMatch;
      }

      return match;
    });
  }

  return updatedMatches;
}
