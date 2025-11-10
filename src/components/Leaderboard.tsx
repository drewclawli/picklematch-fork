import { Match } from "@/lib/scheduler";
import { Card } from "@/components/ui/card";
import { Trophy, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeaderboardProps {
  players: string[];
  matches: Match[];
  matchScores: Map<string, { team1: number; team2: number }>;
}

interface PlayerStats {
  player: string;
  wins: number;
  losses: number;
  matchesPlayed: number;
  winRate: number;
  totalScored: number;
  totalAllowed: number;
  differential: number;
  differentialPerGame: number;
  placement?: number;
  roundsWon?: number;
}

export const Leaderboard = ({ players, matches, matchScores }: LeaderboardProps) => {
  // Detect if this is a tournament
  const isTournament = matches.some(m => m.tournamentMetadata);

  // Calculate stats for each player
  const playerStats = players.map(player => {
    let wins = 0;
    let losses = 0;
    let totalScored = 0;
    let totalAllowed = 0;
    let matchesPlayed = 0;
    let lastRound = 0;

    matches.forEach(match => {
      const score = matchScores.get(match.id);
      if (!score) return;

      const isInTeam1 = match.team1.some(p => p === player);
      const isInTeam2 = match.team2.some(p => p === player);
      
      if (!isInTeam1 && !isInTeam2) return;

      matchesPlayed++;
      const team1Score = typeof score.team1 === 'number' ? score.team1 : Number(score.team1);
      const team2Score = typeof score.team2 === 'number' ? score.team2 : Number(score.team2);

      if (isTournament && match.tournamentMetadata) {
        lastRound = Math.max(lastRound, match.tournamentMetadata.round);
      }

      if (isInTeam1) {
        totalScored += team1Score;
        totalAllowed += team2Score;
        if (team1Score > team2Score) {
          wins++;
        } else if (team1Score < team2Score) {
          losses++;
        }
      } else if (isInTeam2) {
        totalScored += team2Score;
        totalAllowed += team1Score;
        if (team2Score > team1Score) {
          wins++;
        } else if (team2Score < team1Score) {
          losses++;
        }
      }
    });

    const winRate = matchesPlayed > 0 ? wins / matchesPlayed : 0;
    const differential = totalScored - totalAllowed;
    const differentialPerGame = matchesPlayed > 0 ? differential / matchesPlayed : 0;

    // Tournament placement calculation
    let placement = 1;
    if (isTournament) {
      const totalRounds = Math.max(...matches.map(m => m.tournamentMetadata?.round || 0));
      if (lastRound === 0) {
        placement = players.length;
      } else {
        placement = Math.pow(2, totalRounds - lastRound);
      }
    }

    return { 
      player, 
      wins, 
      losses, 
      matchesPlayed, 
      winRate, 
      totalScored, 
      totalAllowed, 
      differential, 
      differentialPerGame,
      placement,
      roundsWon: lastRound
    };
  });

  // Sort by placement for tournaments, or by win rate for round robin
  const sortedStats = isTournament 
    ? playerStats.sort((a, b) => {
        if (a.placement !== b.placement) return a.placement - b.placement;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.differentialPerGame - a.differentialPerGame;
      })
    : playerStats.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.differentialPerGame - a.differentialPerGame;
      });

  // Only show leaderboard if there are completed matches
  if (matchScores.size === 0) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Leaderboard</h2>
            <p className="text-[10px] text-muted-foreground">Player rankings</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {isTournament 
            ? "Tournament standings based on advancement rounds and match wins. Players are ranked by how far they progressed in the bracket."
            : "Track player performance with real-time win rates, match records, and point differentials. Our smart ranking system automatically updates as matches complete, showing who leads in wins, scoring efficiency, and overall tournament performance."
          }
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-24 pb-safe">
        <div className="space-y-1.5">
          {sortedStats.map((stat, index) => (
            <Card
              key={stat.player}
              className={`p-2 flex items-center justify-between transition-all ${
                index === 0 && stat.matchesPlayed > 0
                  ? "border-2 border-accent bg-accent/10"
                  : "bg-card"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm text-foreground">{stat.player}</span>
                      {index === 0 && stat.matchesPlayed > 0 && (
                        <Trophy className="w-3 h-3 text-accent" />
                      )}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {stat.matchesPlayed} match{stat.matchesPlayed !== 1 ? 'es' : ''}
                    </div>
                  </div>
                </div>
                
                  <div className="flex items-center gap-3">
                    {isTournament && (
                      <div className="text-center">
                        <div className="text-sm font-extrabold text-accent">
                          {stat.placement === 1 ? '1st' : stat.placement === 2 ? '2nd' : stat.placement === 3 ? '3rd' : `${stat.placement}th`}
                        </div>
                        <div className="text-[9px] text-muted-foreground">Place</div>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-sm font-extrabold text-accent">{(stat.winRate * 100).toFixed(0)}%</div>
                      <div className="text-[9px] text-muted-foreground">WR</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-extrabold text-primary">{stat.wins}-{stat.losses}</div>
                      <div className="text-[9px] text-muted-foreground">W-L</div>
                    </div>
                    {!isTournament && (
                      <>
                        <div className="text-center">
                          <div className={`text-sm font-extrabold ${stat.differential >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {stat.differential >= 0 ? '+' : ''}{stat.differential}
                          </div>
                          <div className="text-[9px] text-muted-foreground">Diff</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-extrabold ${stat.differentialPerGame >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {stat.differentialPerGame >= 0 ? '+' : ''}{stat.differentialPerGame.toFixed(1)}
                          </div>
                          <div className="text-[9px] text-muted-foreground">D/G</div>
                        </div>
                      </>
                    )}
                  </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
