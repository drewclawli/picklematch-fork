import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Clock } from "lucide-react";
import { Match } from "@/lib/scheduler";

interface MatchHistoryProps {
  matches: Match[];
  matchScores: Map<string, { team1: number; team2: number }>;
}

export const MatchHistory = ({ matches, matchScores }: MatchHistoryProps) => {
  // Get completed matches (those with scores)
  const completedMatches = matches.filter(match => {
    const score = matchScores.get(match.id);
    return score !== undefined;
  });

  if (completedMatches.length === 0) {
    return (
      <div className="text-center py-6">
        <Trophy className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-base font-semibold text-foreground mb-1">No Completed Matches</p>
        <p className="text-xs text-muted-foreground">Completed matches will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Match History</h2>
            <p className="text-[10px] text-muted-foreground">{completedMatches.length} completed match{completedMatches.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Review all completed matches with final scores, winning teams, and match timing. 
          Perfect for tracking tournament progress, analyzing team performance, and maintaining 
          a complete record of your pickleball games and tournaments.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-24 pb-safe">
        <div className="space-y-2">
          {completedMatches.map((match) => {
            const score = matchScores.get(match.id);
            if (!score) return null;

            const team1Won = score.team1 > score.team2;
            const team2Won = score.team2 > score.team1;
            
            // Calculate match number (e.g., A2, B3)
            const courtLetter = String.fromCharCode(64 + match.court);
            const courtMatches = completedMatches.filter(m => m.court === match.court);
            const matchIndex = courtMatches.findIndex(m => m.id === match.id) + 1;
            const matchNumber = `${courtLetter}${matchIndex}`;

            return (
              <Card key={match.id} className="p-2 hover:shadow-md transition-shadow">
                <div className="space-y-2">
                  {/* Match Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] font-semibold py-0">
                        {matchNumber}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] py-0">
                        Court {String.fromCharCode(64 + match.court)}
                      </Badge>
                    </div>
                    <Badge variant="secondary" className="text-[10px] py-0">
                      <Clock className="w-2.5 h-2.5 mr-0.5" />
                      {match.clockStartTime || `${match.startTime} min`}
                    </Badge>
                  </div>

                  {/* Teams and Scores */}
                  <div className="space-y-1.5">
                    {/* Team 1 */}
                    <div className={`flex items-center justify-between p-2 rounded-lg ${
                      team1Won ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                    }`}>
                      <div className="flex items-center gap-1.5 flex-1">
                        <Users className="w-3 h-3 text-primary" />
                        <div className="flex flex-wrap gap-1 text-xs">
                          {match.team1.map((player, idx) => (
                            <span key={idx} className={team1Won ? 'font-semibold' : ''}>
                              {player}{idx < match.team1.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {team1Won && <Trophy className="w-3 h-3 text-primary" />}
                        <span className={`text-lg font-bold ${team1Won ? 'text-primary' : 'text-muted-foreground'}`}>
                          {score.team1}
                        </span>
                      </div>
                    </div>

                    {/* Team 2 */}
                    <div className={`flex items-center justify-between p-2 rounded-lg ${
                      team2Won ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                    }`}>
                      <div className="flex items-center gap-1.5 flex-1">
                        <Users className="w-3 h-3 text-primary" />
                        <div className="flex flex-wrap gap-1 text-xs">
                          {match.team2.map((player, idx) => (
                            <span key={idx} className={team2Won ? 'font-semibold' : ''}>
                              {player}{idx < match.team2.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {team2Won && <Trophy className="w-3 h-3 text-primary" />}
                        <span className={`text-lg font-bold ${team2Won ? 'text-primary' : 'text-muted-foreground'}`}>
                          {score.team2}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
