import { useState, useMemo, useEffect, useRef } from "react";
import { Match, regenerateScheduleFromSlot, CourtConfig } from "@/lib/scheduler";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Clock, Users, Trophy, ChevronLeft, ChevronRight, Target, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { validateMatchScore } from "@/lib/validation";
import { useStopwatch } from "@/hooks/use-stopwatch";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
interface ScheduleViewProps {
  matches: Match[];
  onBack: () => void;
  gameConfig: {
    gameDuration: number;
    totalTime: number;
    courts: number;
    teammatePairs?: {
      player1: string;
      player2: string;
    }[];
    courtConfigs?: CourtConfig[];
  };
  allPlayers: string[];
  onScheduleUpdate: (newMatches: Match[], newPlayers: string[]) => void;
  matchScores: Map<string, {
    team1: number;
    team2: number;
  }>;
  onMatchScoresUpdate: (scores: Map<string, {
    team1: number;
    team2: number;
  }>) => void;
  onCourtConfigUpdate?: (configs: CourtConfig[]) => void;
}
export const ScheduleView = ({
  matches,
  onBack,
  gameConfig,
  allPlayers,
  onScheduleUpdate,
  matchScores,
  onMatchScoresUpdate,
  onCourtConfigUpdate
}: ScheduleViewProps) => {
  const {
    toast
  } = useToast();
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [pendingScores, setPendingScores] = useState<Map<string, {
    team1: number | string;
    team2: number | string;
  }>>(new Map());
  const [courtConfigs, setCourtConfigs] = useState<CourtConfig[]>(gameConfig.courtConfigs || Array.from({
    length: gameConfig.courts
  }, (_, i) => ({
    courtNumber: i + 1,
    type: 'doubles' as const
  })));
  const [carouselApis, setCarouselApis] = useState<Map<number, CarouselApi>>(new Map());
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editedTeams, setEditedTeams] = useState<{
    team1: string[];
    team2: string[];
  }>({
    team1: [],
    team2: []
  });
  const [matchStartTimes, setMatchStartTimes] = useState<Map<string, number>>(new Map());
  const [courtTimers, setCourtTimers] = useState<Map<number, {
    startTime: number;
    matchId: string;
  }>>(new Map());
  const [currentView, setCurrentView] = useState<'organizer' | 'player'>('organizer');

  // Helper to normalize scores to numbers
  const normalizeScore = (score: {
    team1: number | string;
    team2: number | string;
  } | undefined) => {
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

  // Get current matches per court (first unscored match on each court)
  const currentMatchesPerCourt = useMemo(() => {
    const matchMap = new Map<number, Match>();
    matches.forEach(match => {
      if (!matchScores.has(match.id) && !matchMap.has(match.court)) {
        matchMap.set(match.court, match);
      }
    });
    return matchMap;
  }, [matches, matchScores]);

  // Initialize or restore timers from database when matches change
  useEffect(() => {
    currentMatchesPerCourt.forEach((match, court) => {
      // Check if this match already has a timer in the database
      if (match.timerStartTime && !courtTimers.has(court)) {
        // Restore timer from database
        setCourtTimers(prev => new Map(prev).set(court, {
          startTime: match.timerStartTime,
          matchId: match.id
        }));
      } else if (!match.timerStartTime && !courtTimers.has(court)) {
        // Start new timer and save to database
        const startTime = Date.now();
        setCourtTimers(prev => new Map(prev).set(court, {
          startTime,
          matchId: match.id
        }));

        // Save timer start to database
        const updatedMatches = matches.map(m => m.id === match.id ? {
          ...m,
          timerStartTime: startTime
        } : m);
        onScheduleUpdate(updatedMatches, allPlayers);
      }
    });
  }, [currentMatchesPerCourt, matches]);

  // Calculate elapsed time for each court
  const [courtElapsedTimes, setCourtElapsedTimes] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    const interval = setInterval(() => {
      const newElapsedTimes = new Map<number, number>();
      courtTimers.forEach((timer, court) => {
        const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
        newElapsedTimes.set(court, elapsed);
      });
      setCourtElapsedTimes(newElapsedTimes);
    }, 1000);
    return () => clearInterval(interval);
  }, [courtTimers]);

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const updatePendingScore = (matchId: string, team: "team1" | "team2", value: string) => {
    // Allow empty string for partial input
    if (value === '') {
      const current = pendingScores.get(matchId) || matchScores.get(matchId) || {
        team1: '',
        team2: ''
      };
      const newPending = new Map(pendingScores);
      newPending.set(matchId, {
        ...current,
        [team]: ''
      });
      setPendingScores(newPending);
      return;
    }

    // Validate the score
    const validation = validateMatchScore(value);
    if (!validation.valid) {
      toast({
        title: "Invalid score",
        description: validation.error,
        variant: "destructive"
      });
      return;
    }
    const current = pendingScores.get(matchId) || matchScores.get(matchId) || {
      team1: '',
      team2: ''
    };
    const newPending = new Map(pendingScores);
    newPending.set(matchId, {
      ...current,
      [team]: validation.value!
    });
    setPendingScores(newPending);
  };
  const startEditingPlayers = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (match) {
      setEditingMatch(matchId);
      setEditedTeams({
        team1: [...match.team1],
        team2: [...match.team2]
      });
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
        toast({
          title: "Invalid team 1",
          description: "Team members must be different",
          variant: "destructive"
        });
        return;
      }
      if (editedTeams.team2[0] && editedTeams.team2[1] && editedTeams.team2[0] === editedTeams.team2[1]) {
        toast({
          title: "Invalid team 2",
          description: "Team members must be different",
          variant: "destructive"
        });
        return;
      }
    }

    // Validate no cross-team duplicates
    const allMatchPlayers = [...editedTeams.team1, ...editedTeams.team2].filter(p => p.trim());
    const uniqueMatchPlayers = new Set(allMatchPlayers);
    if (allMatchPlayers.length !== uniqueMatchPlayers.size) {
      toast({
        title: "Invalid match",
        description: "Players cannot be on both teams",
        variant: "destructive"
      });
      return;
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
      isLocked: true // Lock this manually edited match
    };
    const newMatches = regenerateScheduleFromSlot(updatedPlayers, [...playedMatches, updatedMatch], match.endTime, gameConfig.gameDuration, gameConfig.totalTime, gameConfig.courts, undefined, gameConfig.teammatePairs, courtConfigs, matches);
    onScheduleUpdate(newMatches, updatedPlayers);
    setEditingMatch(null);
    const matchIdx = matches.filter(m => m.court === match.court && m.endTime <= match.endTime).length;
    const matchNumber = `${String.fromCharCode(64 + match.court)}${matchIdx}`;
    toast({
      title: "Players updated",
      description: `Match ${matchNumber} locked, schedule regenerated from next slot`
    });
  };
  const cancelEditingPlayers = () => {
    setEditingMatch(null);
    setEditedTeams({
      team1: [],
      team2: []
    });
  };

  // Helper to check if a match is current or next-up on any court
  const isCurrentOrNextMatch = (matchId: string, scores: Map<string, {
    team1: number;
    team2: number;
  }>) => {
    const unplayedMatches = matches.filter(m => !scores.has(m.id));
    const courtGroups = new Map<number, Match[]>();
    unplayedMatches.forEach(match => {
      if (!courtGroups.has(match.court)) {
        courtGroups.set(match.court, []);
      }
      courtGroups.get(match.court)!.push(match);
    });
    for (const courtMatches of courtGroups.values()) {
      const currentAndNext = courtMatches.slice(0, 2).map(m => m.id);
      if (currentAndNext.includes(matchId)) {
        return true;
      }
    }
    return false;
  };
  const confirmScore = (matchId: string) => {
    const pending = pendingScores.get(matchId);
    if (!pending || pending.team1 === '' || pending.team2 === '' || pending.team1 === undefined || pending.team2 === undefined) {
      toast({
        title: "Please enter both scores",
        variant: "destructive"
      });
      return;
    }
    const team1Score = typeof pending.team1 === 'number' ? pending.team1 : Number(pending.team1);
    const team2Score = typeof pending.team2 === 'number' ? pending.team2 : Number(pending.team2);
    const match = matches.find(m => m.id === matchId);
    const wasAlreadyScored = matchScores.has(matchId);

    // Update scores state
    const newScores = new Map(matchScores);
    newScores.set(matchId, {
      team1: team1Score,
      team2: team2Score
    });
    onMatchScoresUpdate(newScores);

    // Get elapsed time for this court
    const elapsedTime = match ? courtElapsedTimes.get(match.court) || 0 : 0;
    const formattedElapsedTime = formatTime(elapsedTime);

    // Update ALL matches to include ALL scores (both new and existing)
    const updatedMatches = matches.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          score: {
            team1: team1Score,
            team2: team2Score
          },
          clockStartTime: formattedElapsedTime
        };
      }
      // Preserve existing scores using the latest scores map
      const existingScore = newScores.get(m.id);
      if (existingScore) {
        return {
          ...m,
          score: existingScore
        };
      }
      return m;
    });

    // Save to database with all scores preserved
    onScheduleUpdate(updatedMatches, allPlayers);
    const newPending = new Map(pendingScores);
    newPending.delete(matchId);
    setPendingScores(newPending);

    // Reset court timer when score is confirmed for current match (not when editing past scores)
    if (match && !wasAlreadyScored) {
      const newCourtTimers = new Map(courtTimers);
      newCourtTimers.delete(match.court);
      setCourtTimers(newCourtTimers);

      // Clear timerStartTime from the completed match
      const clearedMatches = updatedMatches.map(m => {
        if (m.id === matchId) {
          const {
            timerStartTime,
            ...rest
          } = m;
          return rest as Match;
        }
        return m;
      });
      onScheduleUpdate(clearedMatches, allPlayers);
    }

    // Only check conflicts and schedule adjustments for newly completed matches, not edited ones
    if (!wasAlreadyScored) {
      const completedMatchRef = matches.find(m => m.id === matchId);
      const actualEndTime = completedMatchRef ? completedMatchRef.endTime : 0;
      checkScheduleAdjustment(matchId, actualEndTime, newScores);
      checkPlayerConflicts(newScores);

      // Auto-scroll to next match on the same court
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
    }
    toast({
      title: wasAlreadyScored ? "Score updated" : "Score confirmed"
    });
  };
  const editScore = (matchId: string) => {
    const current = matchScores.get(matchId);
    if (current) {
      // Just move score to pending without removing it from matchScores
      // This keeps the match as "completed" and doesn't trigger conflict checks
      const newPending = new Map(pendingScores);
      newPending.set(matchId, current);
      setPendingScores(newPending);
    }
  };
  const checkPlayerConflicts = (scores: Map<string, {
    team1: number;
    team2: number;
  }>) => {
    const currentMatches = matches.filter(m => !scores.has(m.id));
    const currentMatchesByCourt = new Map<number, Match>();
    const upcomingMatchesByCourt = new Map<number, Match>();

    // Get current match (first unplayed) and upcoming match (second unplayed) for each court
    currentMatches.forEach(match => {
      if (!currentMatchesByCourt.has(match.court)) {
        currentMatchesByCourt.set(match.court, match);
      } else if (!upcomingMatchesByCourt.has(match.court)) {
        upcomingMatchesByCourt.set(match.court, match);
      }
    });

    // Check conflicts between current matches on different courts
    const currentList = Array.from(currentMatchesByCourt.values());
    if (currentList.length > 1) {
      for (let i = 0; i < currentList.length; i++) {
        for (let j = i + 1; j < currentList.length; j++) {
          const m1 = currentList[i];
          const m2 = currentList[j];
          const set1 = new Set<string>([...m1.team1, ...m1.team2]);
          const set2 = new Set<string>([...m2.team1, ...m2.team2]);
          const conflicts = Array.from(set1).filter(p => set2.has(p));
          if (conflicts.length > 0) {
            resolveConflictByAdvancing(m1, m2, conflicts, scores);
            return;
          }
        }
      }
    }

    // Check conflicts between court A's current game and court B's upcoming game (and vice versa)
    currentMatchesByCourt.forEach((currentMatch, courtA) => {
      upcomingMatchesByCourt.forEach((upcomingMatch, courtB) => {
        if (courtA !== courtB) {
          const currentPlayers = new Set<string>([...currentMatch.team1, ...currentMatch.team2]);
          const upcomingPlayers = new Set<string>([...upcomingMatch.team1, ...upcomingMatch.team2]);
          const conflicts = Array.from(currentPlayers).filter(p => upcomingPlayers.has(p));
          if (conflicts.length > 0) {
            // Adjust the upcoming match to resolve conflicts
            adjustUpcomingMatch(upcomingMatch, conflicts, currentPlayers, scores);
            return;
          }
        }
      });
    });
  };
  const resolveConflictByAdvancing = (m1: Match, m2: Match, conflicts: string[], scores: Map<string, {
    team1: number;
    team2: number;
  }>) => {
    // Find which match to advance (the one with more conflicts or later in the list)
    const [keepMatch, advanceMatch] = m1.startTime <= m2.startTime ? [m1, m2] : [m2, m1];
    const playersInUse = new Set<string>([...keepMatch.team1, ...keepMatch.team2]);

    // Look down the roster to find the first conflict-free match
    const courtMatches = matches.filter(m => m.court === advanceMatch.court && !scores.has(m.id));
    const advanceMatchIndex = courtMatches.findIndex(m => m.id === advanceMatch.id);
    let replacementMatch: Match | null = null;
    let replacementIndex = -1;
    for (let i = advanceMatchIndex + 1; i < courtMatches.length; i++) {
      const candidate = courtMatches[i];
      const candidatePlayers = [...candidate.team1, ...candidate.team2];
      const hasConflict = candidatePlayers.some(p => playersInUse.has(p));
      if (!hasConflict) {
        replacementMatch = candidate;
        replacementIndex = i;
        break;
      }
    }
    if (replacementMatch) {
      // Swap the matches
      const advanceGlobalIndex = matches.findIndex(m => m.id === advanceMatch.id);
      const replacementGlobalIndex = matches.findIndex(m => m.id === replacementMatch.id);
      const playedMatches = matches.slice(0, advanceGlobalIndex).map(m => {
        const score = scores.get(m.id);
        return {
          ...m,
          score: score ? normalizeScore(score) : m.score ? normalizeScore(m.score) : undefined
        };
      });

      // Swap the rosters
      const swappedMatch = {
        ...advanceMatch,
        team1: replacementMatch.team1,
        team2: replacementMatch.team2
      };
      const newMatches = regenerateScheduleFromSlot(allPlayers, [...playedMatches, swappedMatch], advanceMatch.endTime, gameConfig.gameDuration, gameConfig.totalTime, gameConfig.courts, undefined, gameConfig.teammatePairs, courtConfigs, matches);
      const merged = newMatches.map(m => {
        const sc = scores.get(m.id);
        return sc ? {
          ...m,
          score: normalizeScore(sc)
        } : m;
      });
      onScheduleUpdate(merged, allPlayers);

      // Only notify if it affects current or next-up matches
      const affectedMatchIsCurrentOrNext = isCurrentOrNextMatch(advanceMatch.id, scores);
      if (affectedMatchIsCurrentOrNext) {
        const matchIdx = matches.filter(m => m.court === advanceMatch.court && m.endTime <= advanceMatch.endTime).length;
        const matchNumber = `${String.fromCharCode(64 + advanceMatch.court)}${matchIdx}`;
        toast({
          title: "Game advanced",
          description: `Match ${matchNumber} roster advanced to resolve conflicts for: ${conflicts.join(', ')}`
        });
      }
    } else {
      // Fallback: adjust players
      adjustUpcomingMatch(advanceMatch, conflicts, playersInUse, scores);
    }
  };
  const adjustUpcomingMatch = (upcomingMatch: Match, conflicts: string[], playersInUse: Set<string>, scores: Map<string, {
    team1: number;
    team2: number;
  }>) => {
    const usedInMatch = new Set<string>();
    const t1 = (upcomingMatch.team1 as string[]).map(p => {
      if (playersInUse.has(p)) return "";
      usedInMatch.add(p);
      return p;
    });
    const t2 = (upcomingMatch.team2 as string[]).map(p => {
      if (playersInUse.has(p)) return "";
      usedInMatch.add(p);
      return p;
    });
    const candidates = allPlayers.filter(p => !playersInUse.has(p) && !usedInMatch.has(p));
    const pickNext = (exclude: string[]) => {
      const pick = candidates.find(c => !exclude.includes(c));
      if (!pick) return null;
      usedInMatch.add(pick);
      const idx = candidates.indexOf(pick);
      if (idx >= 0) candidates.splice(idx, 1);
      return pick;
    };
    if (upcomingMatch.isSingles) {
      if (!t1[0]) t1[0] = pickNext([]) || "";
      if (!t2[0]) t2[0] = pickNext([]) || "";
    } else {
      if (!t1[0]) t1[0] = pickNext([t1[1]].filter(Boolean) as string[]) || "";
      if (!t1[1]) t1[1] = pickNext([t1[0]].filter(Boolean) as string[]) || "";
      if (!t2[0]) t2[0] = pickNext([t2[1]].filter(Boolean) as string[]) || "";
      if (!t2[1]) t2[1] = pickNext([t2[0]].filter(Boolean) as string[]) || "";
    }
    if (t1.some(x => !x) || t2.some(x => !x)) {
      toast({
        title: "Conflict detected",
        description: "Not enough available players to adjust.",
        variant: "destructive"
      });
      return;
    }
    const updatedMatch: Match = {
      ...upcomingMatch,
      team1: upcomingMatch.isSingles ? [t1[0]] as [string] : [t1[0], t1[1]] as [string, string],
      team2: upcomingMatch.isSingles ? [t2[0]] as [string] : [t2[0], t2[1]] as [string, string]
    };
    const matchIndex = matches.findIndex(m => m.id === upcomingMatch.id);
    const playedMatches = matches.slice(0, matchIndex).map(m => {
      const score = scores.get(m.id);
      return {
        ...m,
        score: score ? normalizeScore(score) : m.score ? normalizeScore(m.score) : undefined
      };
    });
    const newMatches = regenerateScheduleFromSlot(allPlayers, [...playedMatches, updatedMatch], upcomingMatch.endTime, gameConfig.gameDuration, gameConfig.totalTime, gameConfig.courts, undefined, gameConfig.teammatePairs, courtConfigs, matches);
    const mergedMatches = newMatches.map(m => {
      const sc = scores.get(m.id);
      return sc ? {
        ...m,
        score: normalizeScore(sc)
      } : m;
    });
    onScheduleUpdate(mergedMatches, allPlayers);

    // Only notify if it affects current or next-up matches
    const affectedMatchIsCurrentOrNext = isCurrentOrNextMatch(upcomingMatch.id, scores);
    if (affectedMatchIsCurrentOrNext) {
      const matchIdx = matches.filter(m => m.court === upcomingMatch.court && m.endTime <= upcomingMatch.endTime).length;
      const matchNumber = `${String.fromCharCode(64 + upcomingMatch.court)}${matchIdx}`;
      toast({
        title: "Upcoming game adjusted",
        description: `Match ${matchNumber} roster adjusted to avoid conflicts for: ${conflicts.join(', ')}`
      });
    }
  };
  const checkScheduleAdjustment = (completedMatchId: string, actualEndTime: number, scores: Map<string, {
    team1: number;
    team2: number;
  }>) => {
    const completedMatch = matches.find(m => m.id === completedMatchId);
    if (!completedMatch) return;
    const scheduledEndTime = completedMatch.endTime;
    const timeDifference = actualEndTime - scheduledEndTime;
    if (Math.abs(timeDifference) > 5) {
      const matchIndex = matches.findIndex(m => m.id === completedMatchId);
      const playedMatches = matches.slice(0, matchIndex + 1).map(m => {
        const score = scores.get(m.id);
        return {
          ...m,
          score: score ? normalizeScore(score) : m.score ? normalizeScore(m.score) : undefined,
          actualEndTime: m.id === completedMatchId ? actualEndTime : m.endTime
        };
      });
      const remainingTime = gameConfig.totalTime - actualEndTime;
      const potentialNewMatches = Math.floor(remainingTime / gameConfig.gameDuration) * gameConfig.courts;
      const currentFutureMatches = matches.length - (matchIndex + 1);
      if (potentialNewMatches !== currentFutureMatches) {
        const newMatches = regenerateScheduleFromSlot(allPlayers, playedMatches, actualEndTime, gameConfig.gameDuration, gameConfig.totalTime, gameConfig.courts, undefined, gameConfig.teammatePairs, courtConfigs, matches);

        // Merge existing confirmed scores back into regenerated matches
        const mergedMatches = newMatches.map(m => {
          const sc = scores.get(m.id);
          return sc ? {
            ...m,
            score: normalizeScore(sc)
          } : m;
        });
        onScheduleUpdate(mergedMatches, allPlayers);

        // Always notify schedule adjustments as they affect current/upcoming matches
        const completedMatchIdx = matches.filter(m => m.court === completedMatch.court && m.endTime <= completedMatch.endTime).length;
        const completedMatchNumber = `${String.fromCharCode(64 + completedMatch.court)}${completedMatchIdx}`;
        const matchDiff = mergedMatches.length - matches.length;
        if (matchDiff > 0) {
          toast({
            title: "Schedule adjusted",
            description: `After match ${completedMatchNumber}, added ${matchDiff} match(es) due to faster pace`
          });
        } else if (matchDiff < 0) {
          toast({
            title: "Schedule adjusted",
            description: `After match ${completedMatchNumber}, removed ${Math.abs(matchDiff)} match(es) due to slower pace`
          });
        }
      }
    }
  };
  const toggleCourtType = (courtNumber: number) => {
    const updatedConfigs = courtConfigs.map(config => config.courtNumber === courtNumber ? {
      ...config,
      type: config.type === 'singles' ? 'doubles' as const : 'singles' as const
    } : config);
    setCourtConfigs(updatedConfigs);

    // Notify parent component of config change
    if (onCourtConfigUpdate) {
      onCourtConfigUpdate(updatedConfigs);
    }
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
    const newMatches = regenerateScheduleFromSlot(allPlayers, playedMatches, firstUnplayedMatch.startTime, gameConfig.gameDuration, gameConfig.totalTime, gameConfig.courts, undefined, gameConfig.teammatePairs, updatedConfigs, matches);
    onScheduleUpdate(newMatches, allPlayers);
    const courtLetter = String.fromCharCode(64 + courtNumber);
    const typeText = updatedConfigs.find(c => c.courtNumber === courtNumber)?.type === 'singles' ? 'Singles' : 'Doubles';
    toast({
      title: "Court type updated",
      description: `Court ${courtLetter} changed to ${typeText}, schedule regenerated`
    });
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

  // Auto-scroll to current match when component is displayed, carousels are ready, or matches change
  useEffect(() => {
    if (carouselApis.size > 0) {
      // Small delay to ensure carousel is fully rendered
      setTimeout(() => {
        courtConfigs.forEach(config => {
          scrollToCurrentMatch(config.courtNumber);
        });
      }, 100);
    }
  }, [carouselApis.size, matches, matchScores]);

  // Conflict checks are performed after confirming a score to avoid render-loop adjustments
  // useEffect(() => {
  //   checkPlayerConflicts(matchScores);
  // }, []);

  return <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-1 border-b mb-2">
        <div className="flex items-center justify-between gap-2 px-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Trophy className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Match Schedule</h2>
              <p className="text-[10px] text-muted-foreground">{matches.length} matches • {allPlayers.length} players</p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView('player')}
            className="h-8 text-xs px-3 gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            Player View
          </Button>
        </div>
      </div>

      {/* Courts Grid - Vertical layout with Court A above Court B */}
      <div className="grid grid-cols-1 gap-2 px-2 pb-2">
        {courtConfigs.map(courtConfig => {
        const courtMatches = matches.filter(m => m.court === courtConfig.courtNumber);
        const currentMatchIndex = courtMatches.findIndex(m => !matchScores.has(m.id));
        return <div key={courtConfig.courtNumber} className="space-y-2">
              {/* Court Header - Compact */}
              <div className={`flex items-center justify-between gap-2 rounded-lg p-2 border ${courtConfig.courtNumber === 1 ? 'bg-greenery border-greenery/30' : 'bg-pantone-493c border-pantone-493c/30'}`}>
                <div className="flex items-center gap-2">
                  <Badge className="bg-white/90 text-gray-800 text-xs px-1.5 py-0.5 font-semibold">
                    Court {String.fromCharCode(64 + courtConfig.courtNumber)}
                  </Badge>
                  <span className="text-[10px] text-white/90 font-medium">
                    {currentMatchIndex >= 0 ? `${currentMatchIndex + 1}/${courtMatches.length}` : `${courtMatches.length} matches`}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Singles/Doubles Toggle */}
                  <div className="flex items-center gap-1 p-1 rounded-lg border border-white/20 bg-white/90 text-[10px]">
                    <span className={courtConfig.type === 'doubles' ? 'text-gray-800 font-medium' : 'text-gray-500'}>
                      Doubles
                    </span>
                    <Switch checked={courtConfig.type === 'singles'} onCheckedChange={() => toggleCourtType(courtConfig.courtNumber)} disabled={matchScores.size > 0} className="scale-75" />
                    <span className={courtConfig.type === 'singles' ? 'text-gray-800 font-medium' : 'text-gray-500'}>
                      Singles
                    </span>
                  </div>
                  
                  {/* Current Match Button */}
                  {currentMatchIndex >= 0 && <Button onClick={() => scrollToCurrentMatch(courtConfig.courtNumber)} variant="outline" size="sm" className="gap-1 h-6 text-[10px] px-2 bg-white/90 text-gray-800 border-white/30 hover:bg-white">
                      <Target className="w-2.5 h-2.5" />
                      Current
                    </Button>}
                </div>
              </div>

              {/* Carousel - Optimized for viewport */}
              <Carousel opts={{
            align: "start",
            loop: false
          }} className="w-full" setApi={api => {
            if (api) {
              setCarouselApis(prev => new Map(prev).set(courtConfig.courtNumber, api));
            }
          }}>
                <CarouselContent className="-ml-2 max-w-full">
                  {courtMatches.map((match, idx) => {
                const isCurrentMatch = idx === currentMatchIndex;
                const isNextMatch = idx === currentMatchIndex + 1;
                const isPreviousMatch = idx < currentMatchIndex;
                const confirmedScores = matchScores.get(match.id);
                const pendingForMatch = pendingScores.get(match.id);
                const scores = pendingForMatch || confirmedScores || {
                  team1: '',
                  team2: ''
                };
                const isCompleted = matchScores.has(match.id);
                const hasPending = pendingScores.has(match.id);
                return <CarouselItem key={match.id} className="pl-2 basis-[80%] sm:basis-[60%] md:basis-[45%] lg:basis-[35%]">
                        <Card className={`p-1.5 transition-all max-w-full md:aspect-[5/3] md:max-h-[220px] ${isCurrentMatch ? courtConfig.courtNumber === 1 ? 'border-2 border-greenery bg-greenery/20 shadow-lg' : 'border-2 border-pantone-493c bg-pantone-493c/20 shadow-lg' : isNextMatch ? courtConfig.courtNumber === 1 ? 'border border-gray-mist/50 bg-gray-mist/30' : 'border border-larkspur/50 bg-larkspur/20' : isPreviousMatch ? 'bg-muted/40 opacity-60' : 'bg-card opacity-80'}`}>
                          <div className="space-y-1 max-w-full overflow-hidden">
                            {/* Match Status Header */}
                            <div className="flex items-center justify-between">
                              <Badge className={`text-xs py-0 ${isCurrentMatch ? 'bg-primary text-primary-foreground' : isNextMatch ? 'bg-accent text-accent-foreground' : isPreviousMatch ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                                {String.fromCharCode(64 + courtConfig.courtNumber)}{idx + 1} {isCurrentMatch ? '• Current' : isNextMatch ? '• Up Next' : isPreviousMatch ? '• Done' : ''}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] py-0">
                                <Clock className="w-2.5 h-2.5 mr-0.5" />
                                {match.elapsedTime || `${new Date(Date.now() + match.startTime * 60000).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}`}
                              </Badge>
                            </div>

                            {/* Team 1 */}
                            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-primary/50">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <Users className="w-3.5 h-3.5 text-primary-foreground flex-shrink-0" />
                                {editingMatch === match.id ? <div className="flex-1 min-w-0 space-y-1">
                                    <Select value={editedTeams.team1[0] || ""} onValueChange={v => updateEditedPlayer('team1', 0, v)}>
                                      <SelectTrigger className="h-6 text-xs">
                                        <SelectValue placeholder="Player 1" />
                                      </SelectTrigger>
                                      <SelectContent className="z-50">
                                        {allPlayers.filter(p => p !== editedTeams.team1[1]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    {!match.isSingles && <Select value={editedTeams.team1[1] || ""} onValueChange={v => updateEditedPlayer('team1', 1, v)}>
                                        <SelectTrigger className="h-6 text-xs">
                                          <SelectValue placeholder="Player 2" />
                                        </SelectTrigger>
                                        <SelectContent className="z-50">
                                          {allPlayers.filter(p => p !== editedTeams.team1[0]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                      </Select>}
                                  </div> : <div className="font-semibold text-xs min-w-0">
                                    <div className="truncate">{match.team1[0]}</div>
                                    {!match.isSingles && match.team1[1] && <div className="text-muted-foreground text-[10px] truncate">{match.team1[1]}</div>}
                                  </div>}
                              </div>
                              {isCurrentMatch || hasPending ? <Input type="number" min="0" value={scores.team1} onChange={e => updatePendingScore(match.id, "team1", e.target.value)} placeholder="0" className="w-12 h-8 text-center text-lg font-bold flex-shrink-0" disabled={isCompleted && !hasPending} /> : confirmedScores ? <div className="w-12 h-8 flex items-center justify-center text-lg font-bold">
                                  {confirmedScores.team1}
                                </div> : <div className="w-12 h-8 flex items-center justify-center text-muted-foreground">
                                  -
                                </div>}
                            </div>

                            {/* VS with Change Players Button */}
                            <div className="flex items-center justify-center gap-2">
                              <div className="text-[10px] font-bold text-muted-foreground">VS</div>
                              {isCurrentMatch && !editingMatch && <Button onClick={() => startEditingPlayers(match.id)} variant="outline" className="h-6 px-3 text-[10px]" size="sm">
                                  Change Players
                                </Button>}
                            </div>

                            {/* Team 2 */}
                              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-secondary/50">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <Users className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                                  {editingMatch === match.id ? <div className="flex-1 min-w-0 space-y-1">
                                      <Select value={editedTeams.team2[0] || ""} onValueChange={v => updateEditedPlayer('team2', 0, v)}>
                                        <SelectTrigger className="h-6 text-xs">
                                          <SelectValue placeholder="Player 1" />
                                        </SelectTrigger>
                                        <SelectContent className="z-50">
                                          {allPlayers.filter(p => p !== editedTeams.team2[1]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                      {!match.isSingles && <Select value={editedTeams.team2[1] || ""} onValueChange={v => updateEditedPlayer('team2', 1, v)}>
                                          <SelectTrigger className="h-6 text-xs">
                                            <SelectValue placeholder="Player 2" />
                                          </SelectTrigger>
                                          <SelectContent className="z-50">
                                            {allPlayers.filter(p => p !== editedTeams.team2[0]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                          </SelectContent>
                                        </Select>}
                                    </div> : <div className="font-semibold text-xs min-w-0">
                                      <div className="truncate">{match.team2[0]}</div>
                                      {!match.isSingles && match.team2[1] && <div className="text-muted-foreground text-[10px] truncate">{match.team2[1]}</div>}
                                    </div>}
                                </div>
                                {isCurrentMatch || hasPending ? <Input type="number" min="0" value={scores.team2} onChange={e => updatePendingScore(match.id, "team2", e.target.value)} placeholder="0" className="w-12 h-8 text-center text-lg font-bold flex-shrink-0" disabled={isCompleted && !hasPending} /> : confirmedScores ? <div className="w-12 h-8 flex items-center justify-center text-lg font-bold">
                                    {confirmedScores.team2}
                                  </div> : <div className="w-12 h-8 flex items-center justify-center text-muted-foreground">
                                    -
                                  </div>}
                              </div>

                            {/* Timer and Action Buttons */}
                            {isCurrentMatch && <div className="space-y-1">
                                {/* Stopwatch */}
                                <div className="flex items-center justify-center gap-1.5 py-0.5 px-2 rounded-lg bg-primary/10 border border-primary/20">
                                  <Timer className="w-3 h-3 text-primary animate-pulse" />
                                  <span className="text-xs font-bold text-primary">
                                    {formatTime(courtElapsedTimes.get(match.court) || 0)}
                                  </span>
                                </div>
                                
                                {editingMatch === match.id ? <div className="flex gap-1.5">
                                    <Button onClick={saveEditedPlayers} className="flex-1 h-7 text-xs" size="sm">
                                      Save
                                    </Button>
                                    <Button onClick={cancelEditingPlayers} variant="outline" className="flex-1 h-7 text-xs" size="sm">
                                      Cancel
                                    </Button>
                                  </div> : <>
                                    {!isCompleted && <Button onClick={() => confirmScore(match.id)} className="w-full h-7 text-xs" size="sm" disabled={!hasPending}>
                                        Confirm & Next
                                      </Button>}
                                    {isCompleted && !hasPending && <Button onClick={() => editScore(match.id)} variant="outline" className="w-full h-7 text-xs" size="sm">
                                        Edit Score
                                      </Button>}
                                  </>}
                              </div>}
                            
                            {/* Edit Score Button for Completed Matches */}
                            {!isCurrentMatch && isCompleted && !hasPending && <Button onClick={() => editScore(match.id)} variant="outline" className="w-full h-7 text-xs mt-2" size="sm">
                                Edit Score
                              </Button>}
                            
                            {/* Save Score Button for Past Matches Being Edited */}
                            {!isCurrentMatch && hasPending && <Button onClick={() => confirmScore(match.id)} className="w-full h-7 text-xs mt-2" size="sm">
                                Save Score
                              </Button>}
                          </div>
                        </Card>
                      </CarouselItem>;
              })}
                </CarouselContent>
                <CarouselPrevious className="-left-2 h-8 w-8" />
                <CarouselNext className="-right-2 h-8 w-8" />
              </Carousel>
            </div>;
      })}
      </div>
    </div>;
};