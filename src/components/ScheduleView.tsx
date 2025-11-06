import { useState, useMemo } from "react";
import { Match, regenerateScheduleFromSlot } from "@/lib/scheduler";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Clock, Users, Share2, Medal, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ScheduleViewProps {
  matches: Match[];
  onBack: () => void;
  gameConfig: {
    gameDuration: number;
    totalTime: number;
    courts: number;
    startTime: string;
  };
  allPlayers: string[];
  onScheduleUpdate: (newMatches: Match[], newPlayers: string[]) => void;
}

export const ScheduleView = ({ matches, onBack, gameConfig, allPlayers, onScheduleUpdate }: ScheduleViewProps) => {
  const { toast } = useToast();
  const [matchScores, setMatchScores] = useState<Map<string, { team1: number; team2: number }>>(
    new Map()
  );
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);

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

  const leaderboard = useMemo(() => {
    const playerScores = new Map<string, { wins: number; losses: number; points: number }>();
    
    matches.forEach((match) => {
      const scores = matchScores.get(match.id);
      if (!scores) return;
      
      const allPlayers = [...match.team1, ...match.team2];
      allPlayers.forEach((player) => {
        if (!playerScores.has(player)) {
          playerScores.set(player, { wins: 0, losses: 0, points: 0 });
        }
      });
      
      const [p1, p2] = match.team1;
      const [p3, p4] = match.team2;
      
      if (scores.team1 > scores.team2) {
        playerScores.get(p1)!.wins++;
        playerScores.get(p2)!.wins++;
        playerScores.get(p3)!.losses++;
        playerScores.get(p4)!.losses++;
      } else if (scores.team2 > scores.team1) {
        playerScores.get(p3)!.wins++;
        playerScores.get(p4)!.wins++;
        playerScores.get(p1)!.losses++;
        playerScores.get(p2)!.losses++;
      }
      
      playerScores.get(p1)!.points += scores.team1;
      playerScores.get(p2)!.points += scores.team1;
      playerScores.get(p3)!.points += scores.team2;
      playerScores.get(p4)!.points += scores.team2;
    });
    
    return Array.from(playerScores.entries())
      .map(([player, stats]) => ({ player, ...stats }))
      .sort((a, b) => b.wins - a.wins || b.points - a.points);
  }, [matches, matchScores]);

  const handleShare = async () => {
    const shareText = `🏆 Match Results 🏆\n\n` +
      `Leaderboard:\n` +
      leaderboard.map((entry, idx) => 
        `${idx + 1}. ${entry.player} - ${entry.wins}W/${entry.losses}L (${entry.points} pts)`
      ).join('\n') +
      `\n\n` +
      `Total Matches: ${matches.length}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        toast({ title: "Shared successfully!" });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          copyToClipboard(shareText);
        }
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const handleAddPlayer = () => {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) {
      toast({ title: "Please enter a player name", variant: "destructive" });
      return;
    }
    
    if (allPlayers.some(p => p.toLowerCase() === trimmedName.toLowerCase())) {
      toast({ title: "Player already exists", variant: "destructive" });
      return;
    }

    // Find the first match without scores (not yet played)
    const firstUnplayedMatchIndex = matches.findIndex(m => !matchScores.has(m.id));
    
    if (firstUnplayedMatchIndex === -1) {
      toast({ title: "All matches completed", description: "Cannot add players after tournament ends", variant: "destructive" });
      return;
    }

    const firstUnplayedMatch = matches[firstUnplayedMatchIndex];
    
    // Keep matches that have been played
    const playedMatches = matches.slice(0, firstUnplayedMatchIndex);
    
    // Add scores to played matches
    const matchesWithScores = playedMatches.map(m => ({
      ...m,
      score: matchScores.get(m.id)
    }));

    // Regenerate from the next slot
    const updatedPlayers = [...allPlayers, trimmedName];
    const newMatches = regenerateScheduleFromSlot(
      updatedPlayers,
      matchesWithScores,
      firstUnplayedMatch.startTime,
      gameConfig.gameDuration,
      gameConfig.totalTime,
      gameConfig.courts,
      gameConfig.startTime
    );

    onScheduleUpdate(newMatches, updatedPlayers);
    setNewPlayerName("");
    setIsAddPlayerOpen(false);
    toast({ title: "Player added!", description: "Schedule updated from next slot onwards" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
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
              <p className="text-sm text-muted-foreground">{matches.length} matches • {allPlayers.length} players</p>
            </div>
          </div>
        </div>

        <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Player</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="new-player">Player Name</Label>
                <Input
                  id="new-player"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
                  placeholder="Enter player name"
                  className="h-12 text-lg"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Schedule will be regenerated from the next unplayed match onwards.
              </p>
              <Button onClick={handleAddPlayer} className="w-full h-12">
                Add Player & Update Schedule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedMatches).map(([timeSlot, slotMatches]) => {
          const [start, end] = timeSlot.split("-").map(Number);
          return (
            <div key={timeSlot} className="space-y-4">
              <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  {slotMatches[0].clockStartTime ? (
                    `${slotMatches[0].clockStartTime} - ${slotMatches[0].clockEndTime}`
                  ) : (
                    `${start} - ${end} min`
                  )}
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

      {leaderboard.length > 0 && (
        <Card className="p-6 mt-8 bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Medal className="w-6 h-6 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Leaderboard</h2>
            </div>
            <Button onClick={handleShare} className="gap-2">
              <Share2 className="w-4 h-4" />
              Share Results
            </Button>
          </div>
          
          <div className="space-y-3">
            {leaderboard.map((entry, idx) => (
              <div
                key={entry.player}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  idx === 0
                    ? "bg-gradient-to-r from-primary/20 to-accent/20 border-2 border-primary"
                    : "bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    idx === 0 ? "bg-primary text-primary-foreground text-lg" :
                    idx === 1 ? "bg-accent text-accent-foreground" :
                    idx === 2 ? "bg-muted text-muted-foreground" :
                    "bg-secondary text-secondary-foreground"
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{entry.player}</div>
                    <div className="text-sm text-muted-foreground">
                      {entry.wins}W / {entry.losses}L • {entry.points} pts
                    </div>
                  </div>
                </div>
                {idx === 0 && <Trophy className="w-8 h-8 text-primary" />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
