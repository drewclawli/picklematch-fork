/**
 * TournamentVariant - Bracket tournament experience
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trophy, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

import { AppShell, ResponsiveNavigation, useShell } from "@/shell";
import { Card } from "@/components/ui/card";
import { GameCodeDialog } from "@/components/GameCodeDialog";
import { GameSetup } from "@/components/GameSetup";
import { CheckInOut } from "@/components/CheckInOut";
import { ScheduleView } from "@/components/ScheduleView";
import { Leaderboard } from "@/components/Leaderboard";
import { MatchHistory } from "@/components/MatchHistory";
import { supabase } from "@/integrations/supabase/client";
import { safeStorage } from "@/lib/safe-storage";
import { processByeMatches } from "@/lib/tournament-progression";
import { generateTournamentSchedule } from "@/lib/tournament-scheduler";
import { generateQualifierTournamentSchedule } from "@/lib/qualifier-tournament-scheduler";
import type { Match, GameConfig } from "@/core/types";

type TournamentScheduling = NonNullable<GameConfig["schedulingType"]>;

const useTournamentGameState = () => {
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setUserId(session?.user?.id || null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || restoringRef.current) return;
    const restore = async () => {
      restoringRef.current = true;
      const savedGameId = safeStorage.getItem("tournament_game_id");
      const savedGameCode = safeStorage.getItem("tournament_game_code");
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
            safeStorage.removeItem("tournament_game_id");
            safeStorage.removeItem("tournament_game_code");
          }
        } catch {
          safeStorage.removeItem("tournament_game_id");
          safeStorage.removeItem("tournament_game_code");
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
      .channel(`tournament-updates-${gameId}`)
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

export const TournamentVariant: React.FC = () => {
  const { activeSection, setActiveSection } = useShell();
  const state = useTournamentGameState();
  const [showGameCodeDialog, setShowGameCodeDialog] = useState(true);

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
    schedulingType: config.schedulingType && config.schedulingType !== "round-robin" ? config.schedulingType : "single-elimination",
    tournamentPlayStyle: config.tournamentPlayStyle || "doubles",
  });

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
    safeStorage.setItem("tournament_game_id", data.id);
    safeStorage.setItem("tournament_game_code", data.game_code);
    setShowGameCodeDialog(false);
    setActiveSection(loadedMatches.length > 0 ? "matches" : data.players?.length > 0 ? "players" : "setup");
    toast.success(`Joined game: ${code}`);
  };

  const createNewGame = () => {
    safeStorage.removeItem("tournament_game_id");
    safeStorage.removeItem("tournament_game_code");
    setShowGameCodeDialog(false);
    setActiveSection("setup");
  };

  const startNewSession = () => {
    safeStorage.removeItem("tournament_game_id");
    safeStorage.removeItem("tournament_game_code");
    state.setPlayers([]);
    state.setMatches([]);
    state.setGameConfig(null);
    state.setGameId(null);
    state.setGameCode("");
    state.setMatchScores(new Map());
    setShowGameCodeDialog(false);
    setActiveSection("setup");
    toast.success("New tournament session started");
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
      safeStorage.setItem("tournament_game_id", data.id);
      safeStorage.setItem("tournament_game_code", newGameCode);
      setActiveSection("players");
      toast.success(`Tournament created! Code: ${newGameCode}`);
    } catch {
      toast.error("Failed to create tournament");
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
      // Success - no need to show toast for every player change
    } catch (err) {
      // Rollback on error (Issue #3)
      state.setPlayers(previousPlayers);
      state.setGameConfig(previousConfig);
      toast.error("Failed to save players. Changes reverted.");
      console.error("handlePlayersChange error:", err);
    }
  };

  const handlePlayersUpdate = async (players: string[], pairs?: { player1: string; player2: string }[]) => {
    if (!state.gameConfig || !state.gameId) return;

    const gameConfig = { ...state.gameConfig, teammatePairs: pairs };
    state.setPlayers(players);
    state.setGameConfig(gameConfig);

    const schedulingType = (gameConfig.schedulingType || "single-elimination") as TournamentScheduling;
    const isSingles = gameConfig.tournamentPlayStyle === "singles";
    const teamCount = isSingles ? players.length : players.length / 2;

    if (!isSingles && players.length % 2 !== 0) {
      toast.error("Doubles tournaments require an even number of players.");
      return;
    }

    if ((schedulingType === "single-elimination" || schedulingType === "double-elimination") && ![4, 8, 16].includes(teamCount)) {
      toast.error(
        isSingles
          ? "Bracket tournaments require exactly 4, 8, or 16 players."
          : "Bracket doubles require 8, 16, or 32 players to form 4, 8, or 16 teams."
      );
      return;
    }

    try {
      let newSchedule: Match[];
      if (schedulingType === "qualifier-tournament") {
        newSchedule = generateQualifierTournamentSchedule(
          players,
          gameConfig.gameDuration,
          gameConfig.courts,
          (gameConfig.courtConfigs as any) || [],
          pairs || [],
          isSingles,
        ) as unknown as Match[];
      } else {
        newSchedule = generateTournamentSchedule(
          players,
          gameConfig.gameDuration,
          gameConfig.courts,
          schedulingType,
          (gameConfig.courtConfigs as any) || [],
          pairs || [],
          isSingles,
        ) as unknown as Match[];
        newSchedule = processByeMatches(newSchedule as any) as unknown as Match[];
      }

      const sanitized = state.sanitizeMatches(newSchedule);
      state.setMatches(sanitized);
      state.syncMatchScoresFromMatches(sanitized);

      const { error } = await supabase
        .from("games")
        .update({ players, matches: sanitized as any, game_config: gameConfig as any })
        .eq("id", state.gameId);
      if (error) throw error;
      setActiveSection("matches");
      toast.success(schedulingType === "qualifier-tournament" ? "Qualifier bracket generated!" : "Tournament bracket generated!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate tournament bracket");
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
      // Rollback on error (Issue #3)
      state.setMatches(previousMatches);
      state.setPlayers(previousPlayers);
      state.setMatchScores(previousScores);
      toast.error("Failed to save match update. Changes reverted.");
      console.error("handleScheduleUpdate error:", err);
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
      // Rollback on error (Issue #3)
      state.setGameConfig(previousConfig);
      toast.error("Failed to save court config. Changes reverted.");
      console.error("handleCourtConfigUpdate error:", err);
    }
  };

  if (state.isRestoringSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading tournament...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell bottomNav={<ResponsiveNavigation disabled={showGameCodeDialog} />}>
      <GameCodeDialog open={showGameCodeDialog} onOpenChange={setShowGameCodeDialog} onJoinGame={joinExistingGame} onCreateGame={createNewGame} />

      <Card className="p-2 sm:p-3 shadow-sport border-2 border-primary/10 backdrop-blur-sm bg-card/80 flex-1 flex flex-col min-h-0 mb-14">
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
              <ScheduleView
                matches={state.matches as any}
                onBack={() => setActiveSection("players")}
                gameConfig={state.gameConfig as any}
                allPlayers={state.players}
                onScheduleUpdate={(matches, players) => handleScheduleUpdate(matches as any, players)}
                matchScores={state.matchScores}
                onMatchScoresUpdate={state.setMatchScores}
                onCourtConfigUpdate={handleCourtConfigUpdate}
              />
            ) : (
              // Issue #4: Empty state when bracket hasn't been generated yet
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Calendar className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Matches Yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  The tournament bracket hasn't been generated. Add players and generate the bracket to start scoring matches.
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
    </AppShell>
  );
};

export default TournamentVariant;
