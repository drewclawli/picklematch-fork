import { useState, useMemo, useEffect, useRef } from "react";
import { Match, regenerateScheduleFromSlot, CourtConfig } from "@/lib/scheduler";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Clock, Users, Trophy, ChevronLeft, ChevronRight, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

interface ScheduleViewProps {
  matches: Match[];
  onBack: () => void;
  gameConfig: {
    gameDuration: number;
    totalTime: number;
    courts: number;
    teammatePairs?: { player1: string; player2: string }[];
    courtConfigs?: CourtConfig[];
  };
  allPlayers: string[];
  onScheduleUpdate: (newMatches: Match[], newPlayers: string[]) => void;
  matchScores: Map<string, { team1: number; team2: number }>;
  onMatchScoresUpdate: (scores: Map<string, { team1: number; team2: number }>) => void;
}

export const ScheduleView = ({ matches, onBack, gameConfig, allPlayers, onScheduleUpdate, matchScores, onMatchScoresUpdate }: ScheduleViewProps) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [pendingScores, setPendingScores] = useState<Map<string, { team1: number | string; team2: number | string }>>(new Map());
  const [courtConfigs, setCourtConfigs] = useState<CourtConfig[]>(
    gameConfig.courtConfigs || Array.from({ length: gameConfig.courts }, (_, i) => ({ courtNumber: i + 1, type: 'doubles' as const }))
  );
  const [carouselApis, setCarouselApis] = useState<Map<number, CarouselApi>>(new Map());

  // Helper to normalize scores to numbers
  const normalizeScore = (score: { team1: number | string; team2: number | string } | undefined) => {
    if (!score) return undefined;
    return {
      team1: typeof score.team1 === 'number' ? score.team1 : Number(score.team1) || 0,
      team2: typeof score.team2 === 'number' ? score.team2 : Number(score.team2) || 0
    };
  };

  // Find current match based on scores
  const currentMatch = useMemo(() => {
    const unscoredMatch = matches.find(m => !matchScores.has(m.id));
    if (unscoredMatch) {
      return unscoredMatch.id;
    }
    return null;
  }, [matches, matchScores]);

  const updatePendingScore = (matchId: string, team: "team1" | "team2", value: string) => {
    const score = value === '' ? '' : Number(value);
    const current = pendingScores.get(matchId) || matchScores.get(matchId) || { team1: '', team2: '' };
    const newPending = new Map(pendingScores);
    newPending.set(matchId, { ...current, [team]: score });
    setPendingScores(newPending);
  };

  const confirmScore = (matchId: string) => {
    const pending = pendingScores.get(matchId);
    if (!pending || pending.team1 === '' || pending.team2 === '' || pending.team1 === undefined || pending.team2 === undefined) {
      toast({ title: "Please enter both scores", variant: "destructive" });
      return;
    }

    const team1Score = typeof pending.team1 === 'number' ? pending.team1 : Number(pending.team1);
    const team2Score = typeof pending.team2 === 'number' ? pending.team2 : Number(pending.team2);

    const newScores = new Map(matchScores);
    newScores.set(matchId, { team1: team1Score, team2: team2Score });
    onMatchScoresUpdate(newScores);
    
    const newPending = new Map(pendingScores);
    newPending.delete(matchId);
    setPendingScores(newPending);

    const actualEndTime = currentTime;
    checkScheduleAdjustment(matchId, actualEndTime);
    
    // Auto-scroll to next match on the same court
    const match = matches.find(m => m.id === matchId);
    if (match) {
      setTimeout(() => {
        const courtMatches = matches.filter(m => m.court === match.court);
        const nextMatchIndex = courtMatches.findIndex(m => !newScores.has(m.id));
        const api = carouselApis.get(match.court);
        
        if (api && nextMatchIndex >= 0) {
          api.scrollTo(nextMatchIndex, true);
        }
      }, 100);
    }
    
    toast({ title: "Score confirmed" });
  };

  const editScore = (matchId: string) => {
    const current = matchScores.get(matchId);
    if (current) {
      const newPending = new Map(pendingScores);
      newPending.set(matchId, current);
      setPendingScores(newPending);
      
      const newScores = new Map(matchScores);
      newScores.delete(matchId);
      onMatchScoresUpdate(newScores);
    }
  };

  const checkScheduleAdjustment = (completedMatchId: string, actualEndTime: number) => {
    const completedMatch = matches.find(m => m.id === completedMatchId);
    if (!completedMatch) return;

    const scheduledEndTime = completedMatch.endTime;
    const timeDifference = actualEndTime - scheduledEndTime;

    if (Math.abs(timeDifference) > 5) {
      const matchIndex = matches.findIndex(m => m.id === completedMatchId);
      const playedMatches = matches.slice(0, matchIndex + 1).map(m => ({
        ...m,
        score: normalizeScore(matchScores.get(m.id)),
        actualEndTime: m.id === completedMatchId ? actualEndTime : m.endTime,
      }));

      const remainingTime = gameConfig.totalTime - actualEndTime;
      const potentialNewMatches = Math.floor(remainingTime / gameConfig.gameDuration) * gameConfig.courts;
      const currentFutureMatches = matches.length - (matchIndex + 1);

      if (potentialNewMatches !== currentFutureMatches) {
        const newMatches = regenerateScheduleFromSlot(
          allPlayers,
          playedMatches,
          actualEndTime,
          gameConfig.gameDuration,
          gameConfig.totalTime,
          gameConfig.courts,
          undefined,
          gameConfig.teammatePairs,
          courtConfigs
        );

        onScheduleUpdate(newMatches, allPlayers);
        
        const matchDiff = newMatches.length - matches.length;
        if (matchDiff > 0) {
          toast({ title: "Schedule adjusted", description: `Added ${matchDiff} match(es) due to faster pace` });
        } else if (matchDiff < 0) {
          toast({ title: "Schedule adjusted", description: `Removed ${Math.abs(matchDiff)} match(es) due to slower pace` });
        }
      }
    }
  };

  const toggleCourtType = (courtNumber: number) => {
    const updatedConfigs = courtConfigs.map(config => 
      config.courtNumber === courtNumber 
        ? { ...config, type: config.type === 'singles' ? 'doubles' as const : 'singles' as const }
        : config
    );
    setCourtConfigs(updatedConfigs);

    const firstUnplayedMatchIndex = matches.findIndex(m => !matchScores.has(m.id));
    if (firstUnplayedMatchIndex === -1) return;

    const firstUnplayedMatch = matches[firstUnplayedMatchIndex];
    const playedMatches = matches.slice(0, firstUnplayedMatchIndex).map(m => ({
      ...m,
      score: normalizeScore(matchScores.get(m.id))
    }));

    const newMatches = regenerateScheduleFromSlot(
      allPlayers,
      playedMatches,
      firstUnplayedMatch.startTime,
      gameConfig.gameDuration,
      gameConfig.totalTime,
      gameConfig.courts,
      undefined,
      gameConfig.teammatePairs,
      updatedConfigs
    );

    onScheduleUpdate(newMatches, allPlayers);
    toast({ title: "Court type updated", description: "Schedule regenerated" });
  };

  const scrollToCurrentMatch = (courtNumber: number) => {
    const api = carouselApis.get(courtNumber);
    if (!api) return;

    const courtMatches = matches.filter(m => m.court === courtNumber);
    const currentMatchIndex = courtMatches.findIndex(m => !matchScores.has(m.id));
    
    if (currentMatchIndex >= 0) {
      // Scroll to current match so it's prominently displayed with next match visible
      api.scrollTo(currentMatchIndex, true);
    }
  };

  // Auto-scroll to current match when component is displayed or carousels are ready
  useEffect(() => {
    if (carouselApis.size > 0) {
      // Small delay to ensure carousel is fully rendered
      setTimeout(() => {
        courtConfigs.forEach(config => {
          scrollToCurrentMatch(config.courtNumber);
        });
      }, 100);
    }
  }, [carouselApis.size]);

  return (
    <div className="pb-20 max-h-[calc(100vh-5rem)] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-3 border-b mb-4">
        <div className="flex items-center gap-3 px-4 pt-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Match Schedule</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">{matches.length} matches • {allPlayers.length} players</p>
          </div>
        </div>
      </div>

      {/* Courts Grid - Responsive layout to fit both courts on screen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4">
        {courtConfigs.map((courtConfig) => {
          const courtMatches = matches.filter(m => m.court === courtConfig.courtNumber);
          const currentMatchIndex = courtMatches.findIndex(m => !matchScores.has(m.id));

          return (
            <div key={courtConfig.courtNumber} className="space-y-2">
              {/* Court Header */}
              <div className="flex items-center justify-between gap-2">
                <Badge className="bg-primary/20 text-primary text-sm px-2 py-1">
                  Court {courtConfig.courtNumber}
                </Badge>
                
                <div className="flex items-center gap-2">
                  {/* Singles/Doubles Toggle */}
                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg border bg-card text-xs">
                    <span className={courtConfig.type === 'singles' ? 'text-muted-foreground' : 'text-foreground font-medium'}>
                      2v2
                    </span>
                    <Switch
                      checked={courtConfig.type === 'singles'}
                      onCheckedChange={() => toggleCourtType(courtConfig.courtNumber)}
                      disabled={matchScores.size > 0}
                      className="scale-75"
                    />
                    <span className={courtConfig.type === 'singles' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                      1v1
                    </span>
                  </div>
                  
                  {/* Current Match Button */}
                  {currentMatchIndex >= 0 && (
                    <Button
                      onClick={() => scrollToCurrentMatch(courtConfig.courtNumber)}
                      variant="outline"
                      size="sm"
                      className="gap-1 h-8 text-xs"
                    >
                      <Target className="w-3 h-3" />
                      Current
                    </Button>
                  )}
                </div>
              </div>

              {/* Carousel */}
              <Carousel
                opts={{ align: "start", loop: false }}
                className="w-full"
                setApi={(api) => {
                  if (api) {
                    setCarouselApis(prev => new Map(prev).set(courtConfig.courtNumber, api));
                  }
                }}
              >
                <CarouselContent className="-ml-2">
                  {courtMatches.map((match, idx) => {
                    const isCurrentMatch = idx === currentMatchIndex;
                    const isNextMatch = idx === currentMatchIndex + 1;
                    const isPreviousMatch = idx < currentMatchIndex;
                    const confirmedScores = matchScores.get(match.id);
                    const pendingForMatch = pendingScores.get(match.id);
                    const scores = pendingForMatch || confirmedScores || { team1: '', team2: '' };
                    const isCompleted = matchScores.has(match.id);
                    const hasPending = pendingScores.has(match.id);

                    return (
                      <CarouselItem key={match.id} className="pl-2 basis-[75%] sm:basis-[70%] lg:basis-1/3">
                        <Card className={`p-3 transition-all ${
                          isCurrentMatch 
                            ? 'border-2 border-primary bg-primary/5 shadow-lg' 
                            : isNextMatch 
                            ? 'border border-accent bg-accent/5'
                            : isPreviousMatch 
                            ? 'bg-muted/40 opacity-60' 
                            : 'bg-card opacity-80'
                        }`}>
                          <div className="space-y-2">
                            {/* Match Status Header */}
                            <div className="flex items-center justify-between">
                              <Badge className={
                                isCurrentMatch 
                                  ? 'bg-primary text-primary-foreground' 
                                  : isNextMatch
                                  ? 'bg-accent text-accent-foreground'
                                  : isPreviousMatch
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-secondary text-secondary-foreground'
                              }>
                                {isCurrentMatch ? 'Current Match' : isNextMatch ? 'Up Next' : isPreviousMatch ? 'Completed' : `Match ${idx + 1}`}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {match.clockStartTime || `${match.startTime} min`}
                              </Badge>
                            </div>

                            {/* Team 1 */}
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <Users className="w-4 h-4 text-primary flex-shrink-0" />
                                <div className="font-semibold text-sm min-w-0">
                                  <div className="truncate">{match.team1[0]}</div>
                                  {!match.isSingles && match.team1[1] && (
                                    <div className="text-muted-foreground text-xs truncate">{match.team1[1]}</div>
                                  )}
                                </div>
                              </div>
                              {isCurrentMatch ? (
                                <Input
                                  type="number"
                                  min="0"
                                  value={scores.team1}
                                  onChange={(e) => updatePendingScore(match.id, "team1", e.target.value)}
                                  placeholder="0"
                                  className="w-14 h-10 text-center text-xl font-bold flex-shrink-0"
                                  disabled={isCompleted && !hasPending}
                                />
                              ) : confirmedScores ? (
                                <div className="w-14 h-10 flex items-center justify-center text-xl font-bold">
                                  {confirmedScores.team1}
                                </div>
                              ) : (
                                <div className="w-14 h-10 flex items-center justify-center text-muted-foreground">
                                  -
                                </div>
                              )}
                            </div>

                            <div className="text-center text-xs font-bold text-muted-foreground">VS</div>

                            {/* Team 2 */}
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <Users className="w-4 h-4 text-accent flex-shrink-0" />
                                <div className="font-semibold text-sm min-w-0">
                                  <div className="truncate">{match.team2[0]}</div>
                                  {!match.isSingles && match.team2[1] && (
                                    <div className="text-muted-foreground text-xs truncate">{match.team2[1]}</div>
                                  )}
                                </div>
                              </div>
                              {isCurrentMatch ? (
                                <Input
                                  type="number"
                                  min="0"
                                  value={scores.team2}
                                  onChange={(e) => updatePendingScore(match.id, "team2", e.target.value)}
                                  placeholder="0"
                                  className="w-14 h-10 text-center text-xl font-bold flex-shrink-0"
                                  disabled={isCompleted && !hasPending}
                                />
                              ) : confirmedScores ? (
                                <div className="w-14 h-10 flex items-center justify-center text-xl font-bold">
                                  {confirmedScores.team2}
                                </div>
                              ) : (
                                <div className="w-14 h-10 flex items-center justify-center text-muted-foreground">
                                  -
                                </div>
                              )}
                            </div>

                            {/* Action Buttons for Current Match */}
                            {isCurrentMatch && !isCompleted && (
                              <Button 
                                onClick={() => confirmScore(match.id)}
                                className="w-full"
                                disabled={!hasPending}
                              >
                                Confirm Score & Next
                              </Button>
                            )}
                            
                            {isCurrentMatch && isCompleted && !hasPending && (
                              <Button 
                                onClick={() => editScore(match.id)}
                                variant="outline"
                                className="w-full"
                              >
                                Edit Score
                              </Button>
                            )}
                          </div>
                        </Card>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious className="-left-2 h-8 w-8" />
                <CarouselNext className="-right-2 h-8 w-8" />
              </Carousel>
            </div>
          );
        })}
      </div>
    </div>
  );
};
