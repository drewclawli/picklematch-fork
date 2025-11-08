import { useState, useMemo, useEffect } from "react";
import { Match, regenerateScheduleFromSlot, CourtConfig } from "@/lib/scheduler";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Trophy, Clock, Users, Share2, Medal, UserPlus, X, Play, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

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
}

export const ScheduleView = ({ matches, onBack, gameConfig, allPlayers, onScheduleUpdate }: ScheduleViewProps) => {
  const { toast } = useToast();
  const [matchScores, setMatchScores] = useState<Map<string, { team1: number | string; team2: number | string }>>(
    new Map()
  );
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [pendingScores, setPendingScores] = useState<Map<string, { team1: number | string; team2: number | string }>>(new Map());
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editPlayers, setEditPlayers] = useState<{ team1: string[]; team2: string[] }>({ team1: [], team2: [] });
  const [courtConfigs, setCourtConfigs] = useState<CourtConfig[]>(
    gameConfig.courtConfigs || Array.from({ length: gameConfig.courts }, (_, i) => ({ courtNumber: i + 1, type: 'doubles' as const }))
  );

  // Track elapsed time from when schedule was generated (using relative minutes)
  useEffect(() => {
    // currentTime will be managed by match completion rather than real clock time
    // This is now a relative time tracker
  }, []);

  // Track scroll to expand full list
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      // Auto-expand if scrolled more than 800px
      if (window.scrollY > 800 && !showAllMatches) {
        setShowAllMatches(true);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showAllMatches]);

  // Helper to normalize scores to numbers
  const normalizeScore = (score: { team1: number | string; team2: number | string } | undefined) => {
    if (!score) return undefined;
    return {
      team1: typeof score.team1 === 'number' ? score.team1 : Number(score.team1) || 0,
      team2: typeof score.team2 === 'number' ? score.team2 : Number(score.team2) || 0
    };
  };

  // Find current match based on time and scores
  const currentMatch = useMemo(() => {
    // First, find the first unscored match
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
    setMatchScores(newScores);
    
    // Remove from pending
    const newPending = new Map(pendingScores);
    newPending.delete(matchId);
    setPendingScores(newPending);

    // Calculate actual end time and check for schedule adjustment
    const actualEndTime = currentTime;
    checkScheduleAdjustment(matchId, actualEndTime);
    
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
      setMatchScores(newScores);
    }
  };

  const checkScheduleAdjustment = (completedMatchId: string, actualEndTime: number) => {
    const completedMatch = matches.find(m => m.id === completedMatchId);
    if (!completedMatch) return;

    const scheduledEndTime = completedMatch.endTime;
    const timeDifference = actualEndTime - scheduledEndTime;

    // If more than 5 minutes difference, adjust schedule
    if (Math.abs(timeDifference) > 5) {
      const matchIndex = matches.findIndex(m => m.id === completedMatchId);
      const playedMatches = matches.slice(0, matchIndex + 1).map(m => ({
        ...m,
        score: normalizeScore(matchScores.get(m.id)),
        actualEndTime: m.id === completedMatchId ? actualEndTime : m.endTime,
      }));

      // Determine if we need more or fewer matches
      const remainingTime = gameConfig.totalTime - actualEndTime;
      const potentialNewMatches = Math.floor(remainingTime / gameConfig.gameDuration) * gameConfig.courts;
      const currentFutureMatches = matches.length - (matchIndex + 1);

      if (potentialNewMatches !== currentFutureMatches) {
        // Regenerate schedule
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
      
      const team1Score = typeof scores.team1 === 'number' ? scores.team1 : 0;
      const team2Score = typeof scores.team2 === 'number' ? scores.team2 : 0;
      
      const allMatchPlayers = [...match.team1, ...match.team2];
      allMatchPlayers.forEach((player) => {
        if (!playerScores.has(player)) {
          playerScores.set(player, { wins: 0, losses: 0, points: 0 });
        }
      });
      
      const [p1, p2] = match.team1;
      const [p3, p4] = match.team2;
      
      if (team1Score > team2Score) {
        playerScores.get(p1)!.wins++;
        playerScores.get(p2)!.wins++;
        playerScores.get(p3)!.losses++;
        playerScores.get(p4)!.losses++;
      } else if (team2Score > team1Score) {
        playerScores.get(p3)!.wins++;
        playerScores.get(p4)!.wins++;
        playerScores.get(p1)!.losses++;
        playerScores.get(p2)!.losses++;
      }
      
      playerScores.get(p1)!.points += team1Score;
      playerScores.get(p2)!.points += team1Score;
      playerScores.get(p3)!.points += team2Score;
      playerScores.get(p4)!.points += team2Score;
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

    const firstUnplayedMatchIndex = matches.findIndex(m => !matchScores.has(m.id));
    
    if (firstUnplayedMatchIndex === -1) {
      toast({ title: "All matches completed", description: "Cannot add players after tournament ends", variant: "destructive" });
      return;
    }

    const firstUnplayedMatch = matches[firstUnplayedMatchIndex];
    const playedMatches = matches.slice(0, firstUnplayedMatchIndex);
    
    const matchesWithScores = playedMatches.map(m => ({
      ...m,
      score: normalizeScore(matchScores.get(m.id))
    }));

    const updatedPlayers = [...allPlayers, trimmedName];
    const newMatches = regenerateScheduleFromSlot(
      updatedPlayers,
      matchesWithScores,
      firstUnplayedMatch.startTime,
      gameConfig.gameDuration,
          gameConfig.totalTime,
          gameConfig.courts,
          undefined,
          gameConfig.teammatePairs,
          courtConfigs
    );

    onScheduleUpdate(newMatches, updatedPlayers);
    setNewPlayerName("");
    setIsAddPlayerOpen(false);
    toast({ title: "Player added!", description: "Schedule updated from next slot onwards" });
  };

  const handleDeletePlayer = (playerName: string) => {
    const firstUnplayedMatchIndex = matches.findIndex(m => !matchScores.has(m.id));
    
    if (firstUnplayedMatchIndex === -1) {
      toast({ title: "Cannot remove player", description: "All matches completed", variant: "destructive" });
      return;
    }

    const firstUnplayedMatch = matches[firstUnplayedMatchIndex];
    const playedMatches = matches.slice(0, firstUnplayedMatchIndex);
    
    const matchesWithScores = playedMatches.map(m => ({
      ...m,
      score: normalizeScore(matchScores.get(m.id))
    }));

    const updatedPlayers = allPlayers.filter(p => p !== playerName);
    
    if (updatedPlayers.length < 4) {
      toast({ title: "Cannot remove player", description: "Need at least 4 players", variant: "destructive" });
      return;
    }

    // Remove player from teammate pairs if they're in one
    const updatedPairs = (gameConfig.teammatePairs || []).filter(
      pair => pair.player1 !== playerName && pair.player2 !== playerName
    );

    const newMatches = regenerateScheduleFromSlot(
      updatedPlayers,
      matchesWithScores,
      firstUnplayedMatch.startTime,
      gameConfig.gameDuration,
          gameConfig.totalTime,
          gameConfig.courts,
          undefined,
          updatedPairs,
          courtConfigs
    );

    onScheduleUpdate(newMatches, updatedPlayers);
    setPlayerToDelete(null);
    toast({ title: "Player removed", description: "Schedule updated from next slot onwards" });
  };

  const startEditMatch = (match: Match) => {
    setEditingMatch(match.id);
    setEditPlayers({
      team1: [...match.team1],
      team2: [...match.team2]
    });
  };

  const handlePlayerChange = (team: 'team1' | 'team2', index: number, newPlayer: string) => {
    setEditPlayers(prev => ({
      ...prev,
      [team]: prev[team].map((p, i) => i === index ? newPlayer : p)
    }));
  };

  const confirmEditMatch = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    // Validate all players are selected and unique
    const allSelectedPlayers = [...editPlayers.team1, ...editPlayers.team2];
    const uniquePlayers = new Set(allSelectedPlayers);
    
    if (uniquePlayers.size !== allSelectedPlayers.length) {
      toast({ title: "Error", description: "Each player can only be selected once", variant: "destructive" });
      return;
    }

    if (allSelectedPlayers.some(p => !p)) {
      toast({ title: "Error", description: "Please select all players", variant: "destructive" });
      return;
    }

    // Update the match
    const updatedMatches = matches.map(m => 
      m.id === matchId 
        ? { ...m, team1: editPlayers.team1 as any, team2: editPlayers.team2 as any }
        : m
    );

    // Find next unplayed match to regenerate from
    const matchIndex = matches.findIndex(m => m.id === matchId);
    const nextMatchIndex = matchIndex + 1;
    
    if (nextMatchIndex < matches.length) {
      const nextMatch = matches[nextMatchIndex];
      const playedMatches = updatedMatches.slice(0, nextMatchIndex).map(m => ({
        ...m,
        score: normalizeScore(matchScores.get(m.id))
      }));

      const newMatches = regenerateScheduleFromSlot(
        allPlayers,
        playedMatches,
        nextMatch.startTime,
        gameConfig.gameDuration,
          gameConfig.totalTime,
          gameConfig.courts,
          undefined,
          gameConfig.teammatePairs,
          courtConfigs
      );

      onScheduleUpdate(newMatches, allPlayers);
    } else {
      onScheduleUpdate(updatedMatches, allPlayers);
    }

    setEditingMatch(null);
    toast({ title: "Match updated", description: "Schedule adjusted to minimize changes" });
  };

  const toggleCourtType = (courtNumber: number) => {
    const updatedConfigs = courtConfigs.map(config => 
      config.courtNumber === courtNumber 
        ? { ...config, type: config.type === 'singles' ? 'doubles' as const : 'singles' as const }
        : config
    );
    setCourtConfigs(updatedConfigs);

    // Regenerate schedule from next unplayed match
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
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

      {/* Player List with Delete Option */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Active Players</h3>
        <div className="flex flex-wrap gap-2">
          {allPlayers.map((player) => (
            <Badge key={player} variant="secondary" className="px-3 py-1 text-sm">
              {player}
              <button
                onClick={() => setPlayerToDelete(player)}
                className="ml-2 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </Card>

      {/* Court Configuration */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Court Configuration</h3>
        <div className="flex flex-wrap gap-3">
          {courtConfigs.map((config) => (
            <div key={config.courtNumber} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
              <span className="text-sm font-medium">Court {config.courtNumber}:</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${config.type === 'singles' ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                  Doubles
                </span>
                <Switch
                  checked={config.type === 'singles'}
                  onCheckedChange={() => toggleCourtType(config.courtNumber)}
                  disabled={matchScores.size > 0}
                />
                <span className={`text-xs ${config.type === 'singles' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  Singles
                </span>
              </div>
            </div>
          ))}
        </div>
        {matchScores.size > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Court configuration can only be changed before any matches are scored
          </p>
        )}
      </Card>

      <AlertDialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Player</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {playerToDelete} from the game? The schedule will be regenerated from the next unplayed match.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => playerToDelete && handleDeletePlayer(playerToDelete)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Current Matches Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
            <Play className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Current Matches</h3>
            <p className="text-sm text-muted-foreground">Games in progress</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(() => {
            // Find current time slot matches
            const firstUnscored = matches.find(m => !matchScores.has(m.id));
            if (!firstUnscored) return null;
            
            const currentSlotMatches = matches.filter(m => 
              m.startTime === firstUnscored.startTime && m.endTime === firstUnscored.endTime
            );

            return currentSlotMatches.map((match) => {
              const confirmedScores = matchScores.get(match.id);
              const pendingForMatch = pendingScores.get(match.id);
              const scores = pendingForMatch || confirmedScores || { team1: '', team2: '' };
              const isCurrentMatch = match.id === currentMatch;
              const isCompleted = matchScores.has(match.id);
              const hasPending = pendingScores.has(match.id);
              
              return (
                <Card
                  key={match.id}
                  className="p-5 border-l-4 border-l-accent bg-accent/5 ring-2 ring-accent/20"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-accent/10 text-accent hover:bg-accent/20 text-base px-3 py-1">
                        Court {match.court}
                      </Badge>
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        <Clock className="w-3 h-3 mr-1" />
                        {match.clockStartTime || `${match.startTime} min`}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      {editingMatch === match.id ? (
                        /* Edit Mode */
                        <>
                          {/* Team 1 */}
                          <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
                            <Label className="text-xs text-muted-foreground">Team 1</Label>
                            {match.isSingles ? (
                              <Select value={editPlayers.team1[0]} onValueChange={(v) => handlePlayerChange('team1', 0, v)}>
                                <SelectTrigger className="h-10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {allPlayers.map(p => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <>
                                <Select value={editPlayers.team1[0]} onValueChange={(v) => handlePlayerChange('team1', 0, v)}>
                                  <SelectTrigger className="h-10">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allPlayers.map(p => (
                                      <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={editPlayers.team1[1]} onValueChange={(v) => handlePlayerChange('team1', 1, v)}>
                                  <SelectTrigger className="h-10">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allPlayers.map(p => (
                                      <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </>
                            )}
                          </div>

                          <div className="text-center text-sm font-semibold text-muted-foreground">VS</div>

                          {/* Team 2 */}
                          <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
                            <Label className="text-xs text-muted-foreground">Team 2</Label>
                            {match.isSingles ? (
                              <Select value={editPlayers.team2[0]} onValueChange={(v) => handlePlayerChange('team2', 0, v)}>
                                <SelectTrigger className="h-10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {allPlayers.map(p => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <>
                                <Select value={editPlayers.team2[0]} onValueChange={(v) => handlePlayerChange('team2', 0, v)}>
                                  <SelectTrigger className="h-10">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allPlayers.map(p => (
                                      <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={editPlayers.team2[1]} onValueChange={(v) => handlePlayerChange('team2', 1, v)}>
                                  <SelectTrigger className="h-10">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allPlayers.map(p => (
                                      <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              onClick={() => confirmEditMatch(match.id)}
                              className="flex-1"
                            >
                              Confirm Changes
                            </Button>
                            <Button 
                              onClick={() => setEditingMatch(null)}
                              variant="outline"
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        /* View Mode */
                        <>
                          {/* Team 1 */}
                          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-3 flex-1">
                              <Users className="w-5 h-5 text-primary" />
                              <div className="font-semibold text-base">
                                <div>{match.team1[0]}</div>
                                {!match.isSingles && match.team1[1] && (
                                  <div className="text-muted-foreground text-sm">{match.team1[1]}</div>
                                )}
                              </div>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              value={scores.team1}
                              onChange={(e) => updatePendingScore(match.id, "team1", e.target.value)}
                              placeholder="0"
                              className="w-20 h-14 text-center text-2xl font-bold"
                              disabled={isCompleted && !hasPending}
                            />
                          </div>

                          <div className="text-center text-base font-bold text-muted-foreground">
                            VS
                          </div>

                          {/* Team 2 */}
                          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-3 flex-1">
                              <Users className="w-5 h-5 text-accent" />
                              <div className="font-semibold text-base">
                                <div>{match.team2[0]}</div>
                                {!match.isSingles && match.team2[1] && (
                                  <div className="text-muted-foreground text-sm">{match.team2[1]}</div>
                                )}
                              </div>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              value={scores.team2}
                              onChange={(e) => updatePendingScore(match.id, "team2", e.target.value)}
                              placeholder="0"
                              className="w-20 h-14 text-center text-2xl font-bold"
                              disabled={isCompleted && !hasPending}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Edit Players Button for Current Match */}
                    {!isCompleted && editingMatch !== match.id && (
                      <Button 
                        onClick={() => startEditMatch(match)}
                        variant="outline"
                        className="w-full gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Override Players
                      </Button>
                    )}

                    {/* Confirm/Edit Score Buttons */}
                    {!isCompleted && editingMatch !== match.id && (
                      <Button 
                        onClick={() => confirmScore(match.id)}
                        className="w-full mt-2 h-12 text-base"
                        disabled={!hasPending}
                      >
                        Confirm Score & Next Match
                      </Button>
                    )}
                    
                    {isCompleted && !hasPending && editingMatch !== match.id && (
                      <Button 
                        onClick={() => editScore(match.id)}
                        variant="outline"
                        className="w-full mt-2"
                      >
                        Edit Score
                      </Button>
                    )}
                  </div>
                </Card>
              );
            });
          })()}
        </div>
      </div>

      {/* Next Matches - Condensed Preview */}
      {(() => {
        const firstUnscored = matches.find(m => !matchScores.has(m.id));
        if (!firstUnscored) return null;
        
        // Find next time slot after current
        const currentSlotEnd = firstUnscored.endTime;
        const nextSlotMatches = matches.filter(m => 
          m.startTime === currentSlotEnd && !matchScores.has(m.id)
        );

        if (nextSlotMatches.length === 0) return null;

        return (
          <div className="space-y-3 pt-6 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">Up Next</h3>
              </div>
              <Badge variant="outline">
                {nextSlotMatches[0].clockStartTime || `${nextSlotMatches[0].startTime} min`}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nextSlotMatches.map((match) => (
                <Card key={match.id} className="p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">Court {match.court}</Badge>
                    <Badge variant="secondary" className="text-xs">
                      {match.isSingles ? 'Singles' : 'Doubles'}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{match.team1[0]}</span>
                      {!match.isSingles && match.team1[1] && (
                        <span className="text-muted-foreground">& {match.team1[1]}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground text-center">vs</div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{match.team2[0]}</span>
                      {!match.isSingles && match.team2[1] && (
                        <span className="text-muted-foreground">& {match.team2[1]}</span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })()}

      {/* All Matches - Expandable */}
      {showAllMatches ? (
        <div className="space-y-6 pt-8 border-t">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">All Matches</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAllMatches(false)}>
              Hide
            </Button>
          </div>
          {Object.entries(groupedMatches).map(([timeSlot, slotMatches]) => {
            const [start, end] = timeSlot.split("-").map(Number);
            return (
              <div key={timeSlot} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">
                    {slotMatches[0].clockStartTime ? (
                      `${slotMatches[0].clockStartTime} - ${slotMatches[0].clockEndTime}`
                    ) : (
                      `${start} - ${end} min`
                    )}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {slotMatches.map((match) => {
                    const scores = matchScores.get(match.id);
                    const isCompleted = matchScores.has(match.id);
                    
                    return (
                      <Card key={match.id} className={`p-3 ${isCompleted ? 'opacity-60' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs">Court {match.court}</Badge>
                          {isCompleted && <Badge variant="secondary" className="text-xs">Done</Badge>}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="font-medium">{match.team1[0]}</span>
                              {!match.isSingles && match.team1[1] && (
                                <span className="text-muted-foreground text-xs">& {match.team1[1]}</span>
                              )}
                            </div>
                            {scores && <span className="font-bold">{scores.team1}</span>}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="font-medium">{match.team2[0]}</span>
                              {!match.isSingles && match.team2[1] && (
                                <span className="text-muted-foreground text-xs">& {match.team2[1]}</span>
                              )}
                            </div>
                            {scores && <span className="font-bold">{scores.team2}</span>}
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
      ) : (
        <div className="pt-6 border-t">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setShowAllMatches(true)}
          >
            Show All Matches ({matches.length})
          </Button>
        </div>
      )}

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