import { useState } from "react";
import { Match } from "@/lib/scheduler";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Clock, Users } from "lucide-react";

interface ScheduleViewProps {
  matches: Match[];
  onBack: () => void;
}

export const ScheduleView = ({ matches, onBack }: ScheduleViewProps) => {
  const [matchScores, setMatchScores] = useState<Map<string, { team1: number; team2: number }>>(
    new Map()
  );

  const updateScore = (matchId: string, team: "team1" | "team2", score: number) => {
    const current = matchScores.get(matchId) || { team1: 0, team2: 0 };
    setMatchScores(new Map(matchScores.set(matchId, { ...current, [team]: score })));
  };

  const groupedMatches = matches.reduce((acc, match) => {
    const timeSlot = `${match.startTime}-${match.endTime}`;
    if (!acc[timeSlot]) acc[timeSlot] = [];
    acc[timeSlot].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Match Schedule</h2>
            <p className="text-sm text-muted-foreground">{matches.length} matches generated</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedMatches).map(([timeSlot, slotMatches]) => {
          const [start, end] = timeSlot.split("-").map(Number);
          return (
            <div key={timeSlot} className="space-y-4">
              <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  {start} - {end} min
                </h3>
                <Badge variant="secondary" className="ml-2">
                  {slotMatches.length} {slotMatches.length === 1 ? "court" : "courts"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slotMatches.map((match) => {
                  const scores = matchScores.get(match.id) || { team1: 0, team2: 0 };
                  return (
                    <Card
                      key={match.id}
                      className="p-5 hover:shadow-lg transition-all border-l-4 border-l-primary"
                      style={{ boxShadow: "var(--shadow-match)" }}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                            Court {match.court}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          {/* Team 1 */}
                          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-2 flex-1">
                              <Users className="w-4 h-4 text-primary" />
                              <div className="font-medium text-sm">
                                <div>{match.team1[0]}</div>
                                <div className="text-muted-foreground">{match.team1[1]}</div>
                              </div>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              value={scores.team1}
                              onChange={(e) => updateScore(match.id, "team1", Number(e.target.value))}
                              className="w-16 h-12 text-center text-xl font-bold"
                            />
                          </div>

                          <div className="text-center text-sm font-semibold text-muted-foreground">
                            VS
                          </div>

                          {/* Team 2 */}
                          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-2 flex-1">
                              <Users className="w-4 h-4 text-accent" />
                              <div className="font-medium text-sm">
                                <div>{match.team2[0]}</div>
                                <div className="text-muted-foreground">{match.team2[1]}</div>
                              </div>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              value={scores.team2}
                              onChange={(e) => updateScore(match.id, "team2", Number(e.target.value))}
                              className="w-16 h-12 text-center text-xl font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
