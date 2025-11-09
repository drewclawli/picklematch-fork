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
  points: number; // Win points: 3 per win
  totalScored: number; // Total points scored in matches (for tiebreaker)
  matchesPlayed: number;
}

export const Leaderboard = ({ players, matches, matchScores }: LeaderboardProps) => {
  // Calculate stats for each player
  const playerStats = players.map(player => {
    let wins = 0;
    let losses = 0;
    let points = 0; // Win points (3 per win)
    let totalScored = 0; // Total points scored in matches
    let matchesPlayed = 0;

    matches.forEach(match => {
      const score = matchScores.get(match.id);
      if (!score) return;

      const isInTeam1 = match.team1.includes(player);
      const isInTeam2 = match.team2.includes(player);
      
      if (!isInTeam1 && !isInTeam2) return;

      matchesPlayed++;
      const team1Score = typeof score.team1 === 'number' ? score.team1 : Number(score.team1);
      const team2Score = typeof score.team2 === 'number' ? score.team2 : Number(score.team2);

      if (isInTeam1) {
        totalScored += team1Score;
        if (team1Score > team2Score) {
          wins++;
          points += 3; // 3 points per win
        } else if (team1Score < team2Score) {
          losses++;
        }
      } else if (isInTeam2) {
        totalScored += team2Score;
        if (team2Score > team1Score) {
          wins++;
          points += 3; // 3 points per win
        } else if (team2Score < team1Score) {
          losses++;
        }
      }
    });

    return { player, wins, losses, points, totalScored, matchesPlayed };
  });

  // Sort by points (descending), then by totalScored (descending) as tiebreaker
  const sortedStats = playerStats.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.totalScored - a.totalScored;
  });

  // Only show leaderboard if there are completed matches
  if (matchScores.size === 0) return null;

  return (
    <div className="space-y-2 pt-3 border-t">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-accent-foreground" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Leaderboard</h3>
          <p className="text-[10px] text-muted-foreground">Player rankings</p>
        </div>
      </div>

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
                <div className="text-[10px] text-muted-foreground">
                  {stat.matchesPlayed} match{stat.matchesPlayed !== 1 ? 'es' : ''}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-xs font-bold text-accent">{stat.points}</div>
                <div className="text-[9px] text-muted-foreground">Pts</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-primary">{stat.wins}</div>
                <div className="text-[9px] text-muted-foreground">Wins</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-muted-foreground">{stat.totalScored}</div>
                <div className="text-[9px] text-muted-foreground">Scored</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
