/**
 * QualifierVariant - Group Stage + Knockout Tournament Experience
 * Group stage followed by knockout bracket
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trophy, Users, Calendar, Target, ChevronRight, Medal, Swords, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { AppShell, ResponsiveNavigation, useShell, PlayerViewHeader } from "@/shell";
import { GameCodeDialog } from "@/components/GameCodeDialog";
import { GameSetup } from "@/components/GameSetup";
import { CheckInOut } from "@/components/CheckInOut";
import { ScheduleView } from "@/components/ScheduleView";
import { Leaderboard } from "@/components/Leaderboard";
import { MatchHistory } from "@/components/MatchHistory";
import { TournamentBracketDialog } from "@/components/TournamentBracketDialog";
import { PlayerIdentitySelector } from "@/components/PlayerIdentitySelector";
import { MyMatchesView } from "@/components/MyMatchesView";
import { supabase } from "@/integrations/supabase/client";
import { safeStorage } from "@/lib/safe-storage";
import { generateQualifierTournamentSchedule, computeTournamentStructure } from "@/lib/qualifier-tournament-scheduler";
import { usePlayerIdentity } from "@/hooks/use-player-identity";
import { usePlayerMatches } from "@/hooks/use-player-matches";
import { usePlayerNotifications } from "@/hooks/use-player-notifications";
import type { Match, GameConfig } from "@/core/types";

interface StageInfo {
  totalGroups: number;
  groupsOf4: number;
  groupsOf3: number;
  pairs: number;
  qualifiers: number;
  knockoutRounds: number;
}

const useQualifierGameState = () => {
  const [players, setPlayers] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameCode, setGameCode] = useState("");
  const [matchScores, setMatchScores] = useState<Map<string, { team1: number; team2: number }>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const restoringRef = useRef(false);

  const sanitizeMatches = useCallback((arr: Match[]) => {
    const seen = new Map<string, number>();
    return arr.map((m) => {
      const baseId = m.id && m.id.trim() !== "" ? m.id : `match-c${m.court}-t${m.startTime}`;
      const count = seen.get(baseId) || 0;
      seen.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-v${count + 1}`;
      return { ...m, id };
    });
  }, []);

  const syncMatchScoresFromMatches = useCallback((loaded: Match[]) => {
    const next = new Map<string, { team1: number; team2: number }>();
    loaded.forEach((match) => {
      if (match.score) next.set(match.id, match.score);
    });
    setMatchScores(next);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error) setUserId(data.user?.id || null);
      } else {
        setUserId(session.user.id);
      }
    };
    initAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setUserId(session?.user.id || null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || restoringRef.current) return;
    const restore = async () => {
      restoringRef.current = true;
      const savedGameId = safeStorage.getItem("qualifier_game_id");
      const savedGameCode = safeStorage.getItem("qualifier_game_code");
      if (savedGameId && savedGameCode) {
        try {
          const { data, error } = await supabase.from("games").select("*").eq("id", savedGameId).single();
          if (!error && data) {
            const loadedMatches = sanitizeMatches((data.matches as unknown as Match[]) || []);
            setGameId(data.id);
            setGameCode(data.game_code);
            setPlayers(data.players || []);
            setGameConfig(data.game_config as unknown as GameConfig);
            setMatches(loadedMatches);
            syncMatchScoresFromMatches(loadedMatches);
            toast.success(`Session restored: ${data.game_code}`);
          } else {
            safeStorage.removeItem("qualifier_game_id");
            safeStorage.removeItem("qualifier_game_code");
          }
        } catch {
          safeStorage.removeItem("qualifier_game_id");
          safeStorage.removeItem("qualifier_game_code");
        }
      }
      setIsRestoringSession(false);
      restoringRef.current = false;
    };
    restore();
  }, [sanitizeMatches, syncMatchScoresFromMatches, userId]);

  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`qualifier-updates-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new;
            const loadedMatches = sanitizeMatches((updated.matches as unknown as Match[]) || []);
            setPlayers(updated.players || []);
            setMatches(loadedMatches);
            setGameConfig(updated.game_config as unknown as GameConfig);
            syncMatchScoresFromMatches(loadedMatches);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId, sanitizeMatches, syncMatchScoresFromMatches]);

  return {
    players, setPlayers,
    matches, setMatches,
    gameConfig, setGameConfig,
    gameId, setGameId,
    gameCode, setGameCode,
    matchScores, setMatchScores,
    userId,
    isRestoringSession,
    sanitizeMatches,
    syncMatchScoresFromMatches,
  };
};

// Calculate stage info for UI display
const calculateStageInfo = (playerCount: number, isSingles: boolean): StageInfo | null => {
  const teamCount = isSingles ? playerCount : Math.floor(playerCount / 2);
  if (teamCount < 4 || teamCount > 24) return null;
  
  try {
    const structure = computeTournamentStructure(teamCount);
    const knockoutRounds = Math.log2(structure.qualifiers);
    
    return {
      totalGroups: structure.g4 + structure.g3 + structure.g2,
      groupsOf4: structure.g4,
      groupsOf3: structure.g3,
      pairs: structure.g2,
      qualifiers: structure.qualifiers,
      knockoutRounds,
    };
  } catch {
    return null;
  }
};

export const QualifierVariant: React.FC = () => {
  const { activeSection, setActiveSection } = useShell();
  const state = useQualifierGameState();
  const [showGameCodeDialog, setShowGameCodeDialog] = useState(true);
  const [showBracketDialog, setShowBracketDialog] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get("join");
    if (joinCode && state.userId) {
      window.history.replaceState({}, "", window.location.pathname);
      joinExistingGame(joinCode);
    }
  }, [state.userId]);

  const normalizeConfig = (config: GameConfig): GameConfig => ({
    ...config,
    schedulingType: 'qualifier-tournament',
    tournamentPlayStyle: config.tournamentPlayStyle || 'doubles',
  });

  const [showPlayerSelector, setShowPlayerSelector] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { playerName: identityPlayerName, isPlayerView: isIdentityPlayerView, claimIdentity, releaseIdentity } = usePlayerIdentity(state.gameId);
  const playerMatches = usePlayerMatches(state.matches as any, identityPlayerName, state.matchScores);

  usePlayerNotifications(state.matches as any, identityPlayerName, state.gameId, state.matchScores);

  // Update current time every second for player view
  useEffect(() => {
    if (isIdentityPlayerView) {
      const interval = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(interval);
    }
  }, [isIdentityPlayerView]);

  const joinExistingGame = async (code: string) => {
    const { data, error } = await supabase.from("games").select("*").eq("game_code", code).single();
    if (error || !data) {
      toast.error("Game not found");
      return;
    }
    const loadedMatches = state.sanitizeMatches((data.matches as unknown as Match[]) || []);
    state.setGameId(data.id);
    state.setGameCode(data.game_code);
    state.setPlayers(data.players || []);
    state.setGameConfig(normalizeConfig(data.game_config as unknown as GameConfig));
    state.setMatches(loadedMatches);
    state.syncMatchScoresFromMatches(loadedMatches);
    safeStorage.setItem("qualifier_game_id", data.id);
    safeStorage.setItem("qualifier_game_code", data.game_code);
    setShowGameCodeDialog(false);
    setActiveSection(loadedMatches.length > 0 ? "matches" : data.players?.length > 0 ? "players" : "setup");
    toast.success(`Joined game: ${code}`);
  };

  const createNewGame = () => {
    safeStorage.removeItem("qualifier_game_id");
    safeStorage.removeItem("qualifier_game_code");
    setShowGameCodeDialog(false);
    setActiveSection("setup");
  };

  const startNewSession = () => {
    safeStorage.removeItem("qualifier_game_id");
    safeStorage.removeItem("qualifier_game_code");
    state.setPlayers([]);
    state.setMatches([]);
    state.setGameConfig(null);
    state.setGameId(null);
    state.setGameCode("");
    state.setMatchScores(new Map());
    setShowGameCodeDialog(false);
    setActiveSection("setup");
    toast.success("New qualifier session started");
  };

  const handleSetupComplete = async (rawConfig: GameConfig) => {
    if (!state.userId) {
      toast.error("Please wait for authentication");
      return;
    }
    const config = normalizeConfig(rawConfig);
    state.setGameConfig(config);
    try {
      const { data: codeData } = await supabase.rpc("generate_game_code");
      const newGameCode = codeData as string;
      const { data, error } = await supabase
        .from("games")
        .insert([{ game_code: newGameCode, game_config: config as any, players: [], matches: [], creator_id: state.userId }])
        .select()
        .single();
      if (error) throw error;
      state.setGameId(data.id);
      state.setGameCode(newGameCode);
      safeStorage.setItem("qualifier_game_id", data.id);
      safeStorage.setItem("qualifier_game_code", newGameCode);
      setActiveSection("players");
      toast.success(`Qualifier tournament created! Code: ${newGameCode}`);
    } catch {
      toast.error("Failed to create qualifier tournament");
    }
  };

  const handlePlayersChange = async (players: string[], pairs?: { player1: string; player2: string }[]) => {
    const previousPlayers = state.players;
    const previousConfig = state.gameConfig;
    
    state.setPlayers(players);
    if (!state.gameConfig || !state.gameId) return;
    const updatedConfig = { ...state.gameConfig, teammatePairs: pairs };
    state.setGameConfig(updatedConfig);
    
    try {
      const { error } = await supabase.from("games").update({ players, game_config: updatedConfig as any }).eq("id", state.gameId);
      if (error) throw error;
    } catch (err) {
      state.setPlayers(previousPlayers);
      state.setGameConfig(previousConfig);
      toast.error("Failed to save players. Changes reverted.");
    }
  };

  const handlePlayersUpdate = async (players: string[], pairs?: { player1: string; player2: string }[]): Promise<boolean> => {
    if (!state.gameConfig || !state.gameId) return false;

    const previousPlayers = state.players;
    const previousConfig = state.gameConfig;
    const previousMatches = state.matches;
    const previousScores = new Map(state.matchScores);

    const gameConfig = { ...state.gameConfig, teammatePairs: pairs };
    state.setPlayers(players);
    state.setGameConfig(gameConfig);

    const isSingles = gameConfig.tournamentPlayStyle === 'singles';
    const teamCount = isSingles ? players.length : Math.floor(players.length / 2);

    if (!isSingles && players.length % 2 !== 0) {
      state.setPlayers(previousPlayers);
      state.setGameConfig(previousConfig);
      toast.error("Doubles tournaments require an even number of players.");
      return false;
    }

    if (teamCount < 4 || teamCount > 24) {
      state.setPlayers(previousPlayers);
      state.setGameConfig(previousConfig);
      toast.error(isSingles 
        ? "Qualifier tournaments require 4-24 players." 
        : "Qualifier tournaments require 8-48 players (4-24 teams)."
      );
      return false;
    }

    try {
      const newSchedule = generateQualifierTournamentSchedule(
        players,
        gameConfig.gameDuration,
        gameConfig.courts,
        (gameConfig.courtConfigs as any) || [],
        pairs || [],
        isSingles,
      ) as unknown as Match[];

      const sanitized = state.sanitizeMatches(newSchedule);
      state.setMatches(sanitized);
      state.syncMatchScoresFromMatches(sanitized);

      const { error } = await supabase
        .from("games")
        .update({ players, matches: sanitized as any, game_config: gameConfig as any })
        .eq("id", state.gameId);
      if (error) throw error;
      
      // Issue #1 fix: ONLY show bracket dialog after successful save
      setShowBracketDialog(true);
      toast.success("Qualifier bracket generated! Group stage ready.");
      return true; // Issue #1 fix: Return success
    } catch (error: any) {
      state.setPlayers(previousPlayers);
      state.setGameConfig(previousConfig);
      state.setMatches(previousMatches);
      state.setMatchScores(previousScores);
      toast.error(error?.message || "Failed to generate qualifier bracket. Changes reverted.");
      return false; // Issue #1 fix: Return failure
    }
  };

  const handleScheduleUpdate = async (matches: Match[], players: string[]) => {
    const previousMatches = state.matches;
    const previousPlayers = state.players;
    const previousScores = new Map(state.matchScores);
    
    const sanitized = state.sanitizeMatches(matches);
    state.setMatches(sanitized);
    state.setPlayers(players);
    state.syncMatchScoresFromMatches(sanitized);
    if (!state.gameId) return;
    
    try {
      const { error } = await supabase.from("games").update({ matches: sanitized as any, players }).eq("id", state.gameId);
      if (error) throw error;
    } catch (err) {
      state.setMatches(previousMatches);
      state.setPlayers(previousPlayers);
      state.setMatchScores(previousScores);
      toast.error("Failed to save match update. Changes reverted.");
    }
  };

  const handleCourtConfigUpdate = async (courtConfigs: any[]) => {
    if (!state.gameConfig || !state.gameId) return;
    const previousConfig = state.gameConfig;
    const updatedConfig = { ...state.gameConfig, courtConfigs };
    state.setGameConfig(updatedConfig);
    
    try {
      const { error } = await supabase.from("games").update({ game_config: updatedConfig as any }).eq("id", state.gameId);
      if (error) throw error;
    } catch (err) {
      state.setGameConfig(previousConfig);
      toast.error("Failed to save court config. Changes reverted.");
    }
  };

  // Calculate current stage info
  const stageInfo = state.players.length > 0 && state.gameConfig
    ? calculateStageInfo(state.players.length, state.gameConfig.tournamentPlayStyle === 'singles')
    : null;

  // Count completed group matches
  const groupMatches = state.matches.filter(m => m.qualifierMetadata?.isGroupStage);
  const completedGroupMatches = groupMatches.filter(m => state.matchScores.has(m.id));
  const groupStageComplete = groupMatches.length > 0 && completedGroupMatches.length === groupMatches.length;

  // Count completed knockout matches  
  const knockoutMatches = state.matches.filter(m => !m.qualifierMetadata?.isGroupStage);
  const completedKnockoutMatches = knockoutMatches.filter(m => state.matchScores.has(m.id));

  if (state.isRestoringSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading qualifier tournament...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      header={isIdentityPlayerView && identityPlayerName ? (
        <PlayerViewHeader
          playerName={identityPlayerName}
          onExit={() => {
            releaseIdentity();
            toast.success("Switched to organizer view");
          }}
        />
      ) : undefined}
      bottomNav={<ResponsiveNavigation disabled={showGameCodeDialog} />}
    >
      <GameCodeDialog open={showGameCodeDialog} onOpenChange={setShowGameCodeDialog} onJoinGame={joinExistingGame} onCreateGame={createNewGame} />

      {showPlayerSelector && (
        <PlayerIdentitySelector
          players={state.players}
          onSelect={async (name) => {
            await claimIdentity(name);
            setShowPlayerSelector(false);
            toast.success(`You're now playing as ${name}!`);
          }}
          onCancel={() => setShowPlayerSelector(false)}
        />
      )}

      <Card className="p-2 sm:p-3 shadow-sport border-2 border-primary/10 backdrop-blur-sm bg-card/80 flex-1 flex flex-col min-h-0">
        {/* Stage Progress Header - Shows tournament structure */}
        {stageInfo && (
          <div className="px-2 pt-2 pb-2 border-b bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Medal className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Qualifier Tournament</h3>
                  <p className="text-xs text-muted-foreground">
                    {stageInfo.totalGroups} groups • {stageInfo.qualifiers} advance
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Stage badges */}
                <Badge variant={groupMatches.length > 0 ? (groupStageComplete ? "default" : "secondary") : "outline"} className="text-xs">
                  Group Stage
                </Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <Badge variant={knockoutMatches.length > 0 && completedKnockoutMatches.length === knockoutMatches.length ? "default" : "outline"} className="text-xs">
                  Knockout
                </Badge>
                
                {state.matches.length > 0 && (
                  <Button
                    onClick={() => setShowBracketDialog(true)}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs ml-2"
                  >
                    <Trophy className="w-3 h-3" />
                    Bracket
                  </Button>
                )}
              </div>
            </div>
            
            {/* Progress bar */}
            {state.matches.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{completedGroupMatches.length + completedKnockoutMatches.length}/{state.matches.length} matches</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${((completedGroupMatches.length + completedKnockoutMatches.length) / state.matches.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "setup" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
              <GameSetup onComplete={handleSetupComplete} gameCode={state.gameCode} onNewSession={state.gameId ? startNewSession : undefined} />
            </div>
          </div>
        )}

        {activeSection === "players" && state.gameCode && (
          <div className="flex-1 min-h-0 h-full">
            <CheckInOut
              gameCode={state.gameCode}
              players={state.players}
              onPlayersChange={handlePlayersChange}
              onPlayersUpdate={handlePlayersUpdate}
              matches={state.matches as any}
              matchScores={state.matchScores}
              teammatePairs={state.gameConfig?.teammatePairs}
              onNavigateToMatches={() => setActiveSection("matches")}
              hasStartedMatches={state.matches.length > 0}
            />
          </div>
        )}

        {activeSection === "matches" && state.gameConfig && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {state.matches.length > 0 ? (
              isIdentityPlayerView && identityPlayerName ? (
                <MyMatchesView
                  playerName={identityPlayerName}
                  matchGroups={playerMatches}
                  matchScores={state.matchScores}
                  currentTime={currentTime}
                  allMatches={state.matches}
                  onReleaseIdentity={() => {
                    releaseIdentity();
                    toast.success("Switched to organizer view");
                  }}
                  // Skip not supported in qualifier tournaments - all matches required for proper group standings
                  onSkipMatch={undefined}
                />
              ) : (
                <ScheduleView
                  matches={state.matches as any}
                  onBack={() => setActiveSection("players")}
                  gameConfig={state.gameConfig as any}
                  allPlayers={state.players}
                  onScheduleUpdate={(matches, players) => handleScheduleUpdate(matches as any, players)}
                  matchScores={state.matchScores}
                  onMatchScoresUpdate={state.setMatchScores}
                  onCourtConfigUpdate={handleCourtConfigUpdate}
                  isPlayerView={isIdentityPlayerView}
                  playerName={identityPlayerName}
                  onReleaseIdentity={() => {
                    releaseIdentity();
                    toast.success("Switched to organizer view");
                  }}
                  onShowPlayerSelector={() => setShowPlayerSelector(true)}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Calendar className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Matches Yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  The qualifier bracket has not been generated. Add players and generate the bracket to start the tournament.
                </p>
                <Button 
                  onClick={() => setActiveSection("players")}
                  className="gap-2"
                >
                  <Users className="w-4 h-4" />
                  Go to Players
                </Button>
              </div>
            )}
          </div>
        )}

        {activeSection === "history" && <MatchHistory matches={state.matches as any} matchScores={state.matchScores} />}
        {activeSection === "leaderboard" && <Leaderboard players={state.players} matches={state.matches as any} matchScores={state.matchScores} />}
      </Card>

      {/* Tournament Bracket Dialog */}
      {state.matches.length > 0 && (
        <TournamentBracketDialog
          open={showBracketDialog}
          onOpenChange={setShowBracketDialog}
          matches={state.matches}
          matchScores={state.matchScores}
          allPlayers={state.players}
          schedulingType="qualifier-tournament"
        />
      )}
    </AppShell>
  );
};

export default QualifierVariant;
