import { useState, useMemo, useEffect, useRef } from "react";
import { Match, regenerateScheduleFromSlot, CourtConfig } from "@/lib/scheduler";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
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
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editedTeams, setEditedTeams] = useState<{ team1: string[]; team2: string[] }>({ team1: [], team2: [] });

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

  const startEditingPlayers = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (match) {
      setEditingMatch(matchId);
      setEditedTeams({ team1: [...match.team1], team2: [...match.team2] });
    }
  };

  const updateEditedPlayer = (team: 'team1' | 'team2', index: number, value: string) => {
    setEditedTeams(prev => ({
      ...prev,
      [team]: prev[team].map((p, i) => i === index ? value : p)
    }));
  };

  const saveEditedPlayers = () => {
    if (!editingMatch) return;

    const match = matches.find(m => m.id === editingMatch);
    if (!match) return;

    // Validate no duplicate players within the same team
    if (!match.isSingles) {
      if (editedTeams.team1[0] && editedTeams.team1[1] && editedTeams.team1[0] === editedTeams.team1[1]) {
        toast({ title: "Invalid team 1", description: "Team members must be different", variant: "destructive" });
        return;
      }
      if (editedTeams.team2[0] && editedTeams.team2[1] && editedTeams.team2[0] === editedTeams.team2[1]) {
        toast({ title: "Invalid team 2", description: "Team members must be different", variant: "destructive" });
        return;
      }
    }

    const allEditedPlayers = [...editedTeams.team1, ...editedTeams.team2].filter(p => p.trim());
    const updatedPlayers = [...new Set([...allEditedPlayers, ...allPlayers])];

    const matchIndex = matches.findIndex(m => m.id === editingMatch);
    const playedMatches = matches.slice(0, matchIndex).map(m => {
      const score = matchScores.get(m.id);
      return {
        ...m,
        score: score ? normalizeScore(score) : m.score ? normalizeScore(m.score) : undefined
      };
    });

    const updatedMatch = {
      ...match,
      team1: match.isSingles ? [editedTeams.team1[0]] as [string] : editedTeams.team1 as [string, string],
      team2: match.isSingles ? [editedTeams.team2[0]] as [string] : editedTeams.team2 as [string, string],
    };

    const newMatches = regenerateScheduleFromSlot(
      updatedPlayers,
      [...playedMatches, updatedMatch],
      match.endTime,
      gameConfig.gameDuration,
      gameConfig.totalTime,
      gameConfig.courts,
      undefined,
      gameConfig.teammatePairs,
      courtConfigs
    );

    onScheduleUpdate(newMatches, updatedPlayers);
    setEditingMatch(null);
    toast({ title: "Players updated", description: "Schedule regenerated" });
  };

  const cancelEditingPlayers = () => {
    setEditingMatch(null);
    setEditedTeams({ team1: [], team2: [] });
  };

  const confirmScore = (matchId: string) => {
    const pending = pendingScores.get(matchId);
    if (!pending || pending.team1 === '' || pending.team2 === '' || pending.team1 === undefined || pending.team2 === undefined) {
      toast({ title: "Please enter both scores", variant: "destructive" });
      return;
    }

    const team1Score = typeof pending.team1 === 'number' ? pending.team1 : Number(pending.team1);
    const team2Score = typeof pending.team2 === 'number' ? pending.team2 : Number(pending.team2);

    // Update scores state
    const newScores = new Map(matchScores);
    newScores.set(matchId, { team1: team1Score, team2: team2Score });
    onMatchScoresUpdate(newScores);
    
    // Update ALL matches to include ALL scores (both new and existing)
    const updatedMatches = matches.map(m => {
      if (m.id === matchId) {
        return { ...m, score: { team1: team1Score, team2: team2Score } };
      }
      // Preserve existing scores from matchScores state
      const existingScore = matchScores.get(m.id);
      if (existingScore) {
        return { ...m, score: existingScore };
      }
      return m;
    });
    
    // Save to database with all scores preserved
    onScheduleUpdate(updatedMatches, allPlayers);
    
    const newPending = new Map(pendingScores);
    newPending.delete(matchId);
    setPendingScores(newPending);

    const actualEndTime = currentTime;
    checkScheduleAdjustment(matchId, actualEndTime);
    
    // Check for player conflicts in current matches
    checkPlayerConflicts(newScores);
    
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
      
      // Update matches to remove the score
      const updatedMatches = matches.map(m => {
        if (m.id === matchId) {
          const { score, ...rest } = m;
          return rest as Match;
        }
        // Preserve other scores
        const existingScore = matchScores.get(m.id);
        if (existingScore && m.id !== matchId) {
          return { ...m, score: existingScore };
        }
        return m;
      });
      
      onScheduleUpdate(updatedMatches, allPlayers);
    }
  };

  const checkPlayerConflicts = (scores: Map<string, { team1: number; team2: number }>) => {
    const currentMatches = matches.filter(m => !scores.has(m.id));
    const currentMatchesByCourt = new Map<number, Match>();

    currentMatches.forEach(match => {
      if (!currentMatchesByCourt.has(match.court)) {
        currentMatchesByCourt.set(match.court, match);
      }
    });

    const list = Array.from(currentMatchesByCourt.values());
    if (list.length <= 1) return;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const m1 = list[i];
        const m2 = list[j];
        const set1 = new Set<string>([...m1.team1, ...m1.team2]);
        const set2 = new Set<string>([...m2.team1, ...m2.team2]);
        const conflicts = Array.from(set1).filter(p => set2.has(p));

        if (conflicts.length > 0) {
          // Decide which match is 'latter' based on startTime, fallback to order in matches array
          const [earlier, later] = m1.startTime <= m2.startTime ? [m1, m2] : [m2, m1];
          const playersInUse = new Set<string>([...earlier.team1, ...earlier.team2]);

          // Build updated teams for the later match avoiding playersInUse
          const usedInLater = new Set<string>();

          const t1 = (later.team1 as string[]).map(p => {
            if (playersInUse.has(p)) return "";
            usedInLater.add(p);
            return p;
          });
          const t2 = (later.team2 as string[]).map(p => {
            if (playersInUse.has(p)) return "";
            usedInLater.add(p);
            return p;
          });

          const candidates = allPlayers.filter(p => !playersInUse.has(p) && !usedInLater.has(p));
          const pickNext = (exclude: string[]) => {
            const pick = candidates.find(c => !exclude.includes(c));
            if (!pick) return null;
            usedInLater.add(pick);
            const idx = candidates.indexOf(pick);
            if (idx >= 0) candidates.splice(idx, 1);
            return pick;
          };

          if (later.isSingles) {
            if (!t1[0]) t1[0] = pickNext([]) || "";
            if (!t2[0]) t2[0] = pickNext([]) || "";
          } else {
            if (!t1[0]) t1[0] = pickNext([t1[1]].filter(Boolean) as string[]) || "";
            if (!t1[1]) t1[1] = pickNext([t1[0]].filter(Boolean) as string[]) || "";
            if (!t2[0]) t2[0] = pickNext([t2[1]].filter(Boolean) as string[]) || "";
            if (!t2[1]) t2[1] = pickNext([t2[0]].filter(Boolean) as string[]) || "";
          }

          if (t1.some(x => !x) || t2.some(x => !x)) {
            toast({ title: "Conflict detected", description: "Not enough available players to adjust.", variant: "destructive" });
            return;
          }

          const updatedMatch: Match = {
            ...later,
            team1: later.isSingles ? [t1[0]] as [string] : [t1[0], t1[1]] as [string, string],
            team2: later.isSingles ? [t2[0]] as [string] : [t2[0], t2[1]] as [string, string],
          };

          const laterIndex = matches.findIndex(m => m.id === later.id);
          const playedMatches = matches.slice(0, laterIndex).map(m => {
            const score = scores.get(m.id);
            return {
              ...m,
              score: score ? normalizeScore(score) : m.score ? normalizeScore(m.score) : undefined
            };
          });

          const newMatches = regenerateScheduleFromSlot(
            allPlayers,
            [...playedMatches, updatedMatch],
            later.endTime,
            gameConfig.gameDuration,
            gameConfig.totalTime,
            gameConfig.courts,
            undefined,
            gameConfig.teammatePairs,
            courtConfigs
          );

          onScheduleUpdate(newMatches, allPlayers);
          toast({ title: "Schedule adjusted", description: `Resolved conflicts for: ${conflicts.join(', ')}` });
          return;
        }
      }
    }
  };

  const checkScheduleAdjustment = (completedMatchId: string, actualEndTime: number) => {
    const completedMatch = matches.find(m => m.id === completedMatchId);
    if (!completedMatch) return;

    const scheduledEndTime = completedMatch.endTime;
    const timeDifference = actualEndTime - scheduledEndTime;

    if (Math.abs(timeDifference) > 5) {
      const matchIndex = matches.findIndex(m => m.id === completedMatchId);
      const playedMatches = matches.slice(0, matchIndex + 1).map(m => {
        const score = matchScores.get(m.id);
        return {
          ...m,
          score: score ? normalizeScore(score) : m.score ? normalizeScore(m.score) : undefined,
          actualEndTime: m.id === completedMatchId ? actualEndTime : m.endTime,
        };
      });

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
    const playedMatches = matches.slice(0, firstUnplayedMatchIndex).map(m => {
      const score = matchScores.get(m.id);
      return {
        ...m,
        score: score ? normalizeScore(score) : m.score ? normalizeScore(m.score) : undefined
      };
    });

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

  useEffect(() => {
    checkPlayerConflicts(matchScores);
  }, [matches, matchScores]);

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
                                {editingMatch === match.id ? (
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <Select
                                      value={editedTeams.team1[0] || ""}
                                      onValueChange={(v) => updateEditedPlayer('team1', 0, v)}
                                    >
                                      <SelectTrigger className="h-7 text-sm">
                                        <SelectValue placeholder="Player 1" />
                                      </SelectTrigger>
                                      <SelectContent className="z-50">
                                        {allPlayers
                                          .filter((p) => p !== editedTeams.team1[1])
                                          .map((p) => (
                                            <SelectItem key={p} value={p}>{p}</SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                    {!match.isSingles && (
                                      <Select
                                        value={editedTeams.team1[1] || ""}
                                        onValueChange={(v) => updateEditedPlayer('team1', 1, v)}
                                      >
                                        <SelectTrigger className="h-7 text-sm">
                                          <SelectValue placeholder="Player 2" />
                                        </SelectTrigger>
                                        <SelectContent className="z-50">
                                          {allPlayers
                                            .filter((p) => p !== editedTeams.team1[0])
                                            .map((p) => (
                                              <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                ) : (
                                  <div className="font-semibold text-sm min-w-0">
                                    <div className="truncate">{match.team1[0]}</div>
                                    {!match.isSingles && match.team1[1] && (
                                      <div className="text-muted-foreground text-xs truncate">{match.team1[1]}</div>
                                    )}
                                  </div>
                                )}
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
                                {editingMatch === match.id ? (
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <Select
                                      value={editedTeams.team2[0] || ""}
                                      onValueChange={(v) => updateEditedPlayer('team2', 0, v)}
                                    >
                                      <SelectTrigger className="h-7 text-sm">
                                        <SelectValue placeholder="Player 1" />
                                      </SelectTrigger>
                                      <SelectContent className="z-50">
                                        {allPlayers
                                          .filter((p) => p !== editedTeams.team2[1])
                                          .map((p) => (
                                            <SelectItem key={p} value={p}>{p}</SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                    {!match.isSingles && (
                                      <Select
                                        value={editedTeams.team2[1] || ""}
                                        onValueChange={(v) => updateEditedPlayer('team2', 1, v)}
                                      >
                                        <SelectTrigger className="h-7 text-sm">
                                          <SelectValue placeholder="Player 2" />
                                        </SelectTrigger>
                                        <SelectContent className="z-50">
                                          {allPlayers
                                            .filter((p) => p !== editedTeams.team2[0])
                                            .map((p) => (
                                              <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                ) : (
                                  <div className="font-semibold text-sm min-w-0">
                                    <div className="truncate">{match.team2[0]}</div>
                                    {!match.isSingles && match.team2[1] && (
                                      <div className="text-muted-foreground text-xs truncate">{match.team2[1]}</div>
                                    )}
                                  </div>
                                )}
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
                            {isCurrentMatch && editingMatch === match.id && (
                              <div className="flex gap-2">
                                <Button 
                                  onClick={saveEditedPlayers}
                                  className="flex-1"
                                >
                                  Save Players
                                </Button>
                                <Button 
                                  onClick={cancelEditingPlayers}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                            
                            {isCurrentMatch && !editingMatch && (
                              <>
                                <Button 
                                  onClick={() => startEditingPlayers(match.id)}
                                  variant="outline"
                                  className="w-full"
                                >
                                  Change Players
                                </Button>
                                {!isCompleted && (
                                  <Button 
                                    onClick={() => confirmScore(match.id)}
                                    className="w-full"
                                    disabled={!hasPending}
                                  >
                                    Confirm Score & Next
                                  </Button>
                                )}
                                {isCompleted && !hasPending && (
                                  <Button 
                                    onClick={() => editScore(match.id)}
                                    variant="outline"
                                    className="w-full"
                                  >
                                    Edit Score
                                  </Button>
                                )}
                              </>
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
