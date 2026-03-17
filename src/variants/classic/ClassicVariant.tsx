/**
 * ClassicVariant - Round-Robin Tournament Experience
 * Refactored to use the new shell foundation
 */
import React, { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

import { useShell, AppShell, ResponsiveNavigation, PlayerViewHeader } from "@/shell";
import { GameCodeDialog } from "@/components/GameCodeDialog";
import { PlayerIdentitySelector } from "@/components/PlayerIdentitySelector";
import { usePlayerIdentity } from "@/hooks/use-player-identity";
import { usePlayerMatches } from "@/hooks/use-player-matches";
import { usePlayerNotifications } from "@/hooks/use-player-notifications";
import { supabase } from "@/integrations/supabase/client";
import { debugLogger } from "@/lib/debug-logger";
import { safeStorage } from "@/lib/safe-storage";
import { setSkipNextMatch } from "@/lib/player-identity";
import { generateSchedule, regenerateScheduleFromSlot, type CourtConfig } from "@/lib/scheduler";
import type { Match, GameConfig } from "@/core/types";

import { ClassicSetupView } from "./components/ClassicSetupView";
import { ClassicPlayersView } from "./components/ClassicPlayersView";
import { ClassicMatchesView } from "./components/ClassicMatchesView";
import { ClassicLeaderboardView } from "./components/ClassicLeaderboardView";
import { ClassicHistoryView } from "./components/ClassicHistoryView";
import { ClassicMyMatchesView } from "./components/ClassicMyMatchesView";

const useClassicGameState = () => {
  const [players, setPlayers] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameCode, setGameCode] = useState<string>("");
  const [setupComplete, setSetupComplete] = useState(false);
  const [matchScores, setMatchScores] = useState<Map<string, { team1: number; team2: number }>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const isRestoringRef = useRef(false);

  const sanitizeMatches = useCallback((arr: Match[]): Match[] => {
    const seen = new Map<string, number>();
    return arr.map((m) => {
      const baseId = m.id && m.id.trim() !== "" ? m.id : `match-c${m.court}-t${m.startTime}`;
      const count = seen.get(baseId) || 0;
      seen.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-v${count + 1}`;
      return { ...m, id };
    });
  }, []);

  const syncMatchScoresFromMatches = useCallback((loadedMatches: Match[]) => {
    const next = new Map<string, { team1: number; team2: number }>();
    loadedMatches.forEach((match) => {
      if (match.score) {
        next.set(match.id, match.score);
      }
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || isRestoringRef.current) return;

    const restore = async () => {
      isRestoringRef.current = true;
      const savedGameId = safeStorage.getItem("classic_game_id");
      const savedGameCode = safeStorage.getItem("classic_game_code");

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
            setSetupComplete(!!data.game_config);
            toast.success(`Session restored: ${data.game_code}`);
          } else {
            safeStorage.removeItem("classic_game_id");
            safeStorage.removeItem("classic_game_code");
          }
        } catch (err) {
          debugLogger.log("error", "Failed to restore session", err);
        }
      }

      setIsRestoringSession(false);
      isRestoringRef.current = false;
    };

    restore();
  }, [sanitizeMatches, syncMatchScoresFromMatches, userId]);

  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`classic-updates-${gameId}`)
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, sanitizeMatches, syncMatchScoresFromMatches]);

  return {
    players, setPlayers,
    matches, setMatches,
    gameConfig, setGameConfig,
    gameId, setGameId,
    gameCode, setGameCode,
    setupComplete, setSetupComplete,
    matchScores, setMatchScores,
    userId,
    isRestoringSession,
    sanitizeMatches,
    syncMatchScoresFromMatches,
  };
};

export const ClassicVariant: React.FC = () => {
  const { activeSection, setActiveSection } = useShell();
  const [showGameCodeDialog, setShowGameCodeDialog] = useState(true);
  const [showPlayerSelector, setShowPlayerSelector] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const gameState = useClassicGameState();
  const { players, matches, gameConfig, gameId, gameCode, matchScores, setMatchScores } = gameState;

  const { playerName: identityPlayerName, isPlayerView: isIdentityPlayerView, claimIdentity, releaseIdentity } = usePlayerIdentity(gameId);
  const playerMatches = usePlayerMatches(matches as any, identityPlayerName, matchScores);

  usePlayerNotifications(matches as any, identityPlayerName, gameId, matchScores);

  useEffect(() => {
    if (isIdentityPlayerView) {
      const interval = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(interval);
    }
  }, [isIdentityPlayerView]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get("join");

    if (joinCode && gameState.userId) {
      window.history.replaceState({}, "", window.location.pathname);
      joinExistingGame(joinCode);
    }
  }, [gameState.userId]);

  useEffect(() => {
    if (showGameCodeDialog) return;
    if (matches.length > 0) {
      setActiveSection("matches");
    } else if (players.length > 0) {
      setActiveSection("players");
    } else if (gameConfig) {
      setActiveSection("players");
    }
  }, [showGameCodeDialog, matches.length, players.length, gameConfig, setActiveSection]);

  const joinExistingGame = async (code: string) => {
    if (!gameState.userId) {
      toast.error("Please wait for authentication");
      return;
    }

    try {
      const { data, error } = await supabase.from("games").select("*").eq("game_code", code).single();

      if (error || !data) {
        toast.error("Game not found");
        return;
      }

      const loadedMatches = gameState.sanitizeMatches((data.matches as unknown as Match[]) || []);
      gameState.setGameId(data.id);
      gameState.setGameCode(data.game_code);
      gameState.setPlayers(data.players || []);
      gameState.setGameConfig(data.game_config as unknown as GameConfig);
      gameState.setMatches(loadedMatches);
      gameState.syncMatchScoresFromMatches(loadedMatches);
      gameState.setSetupComplete(!!data.game_config);

      safeStorage.setItem("classic_game_id", data.id);
      safeStorage.setItem("classic_game_code", data.game_code);
      setShowGameCodeDialog(false);
      setActiveSection(loadedMatches.length > 0 ? "matches" : data.players?.length > 0 ? "players" : "setup");
      toast.success(`Joined game: ${code}`);
    } catch {
      toast.error("Failed to join game");
    }
  };

  const createNewGame = () => {
    safeStorage.removeItem("classic_game_id");
    safeStorage.removeItem("classic_game_code");
    setShowGameCodeDialog(false);
    setActiveSection("setup");
  };

  const startNewSession = () => {
    safeStorage.removeItem("classic_game_id");
    safeStorage.removeItem("classic_game_code");
    gameState.setPlayers([]);
    gameState.setMatches([]);
    gameState.setGameConfig(null);
    gameState.setGameId(null);
    gameState.setGameCode("");
    gameState.setSetupComplete(false);
    setMatchScores(new Map());
    setShowGameCodeDialog(false);
    setActiveSection("setup");
    toast.success("New session started");
  };

  const handleSetupComplete = async (config: GameConfig) => {
    if (!gameState.userId) {
      toast.error("Please wait for authentication");
      return;
    }

    gameState.setGameConfig(config);
    gameState.setSetupComplete(true);

    try {
      const { data: codeData } = await supabase.rpc("generate_game_code");
      const newGameCode = codeData as string;

      const { data, error } = await supabase
        .from("games")
        .insert([{ game_code: newGameCode, game_config: config as any, players: [], matches: [], creator_id: gameState.userId }])
        .select()
        .single();

      if (error) throw error;

      gameState.setGameId(data.id);
      gameState.setGameCode(newGameCode);
      safeStorage.setItem("classic_game_id", data.id);
      safeStorage.setItem("classic_game_code", newGameCode);
      toast.success(`Game created! Code: ${newGameCode}`);
      setActiveSection("players");
    } catch {
      toast.error("Failed to create game");
    }
  };

  const handlePlayersChange = async (newPlayers: string[], pairs?: { player1: string; player2: string }[]) => {
    gameState.setPlayers(newPlayers);
    if (!gameConfig || !gameId) return;

    const updatedConfig = { ...gameConfig, teammatePairs: pairs };
    gameState.setGameConfig(updatedConfig);

    try {
      const { error } = await supabase.from("games").update({ players: newPlayers, game_config: updatedConfig as any }).eq("id", gameId);
      if (error) throw error;
    } catch {
      toast.error("Failed to sync players");
    }
  };

  const handlePlayersUpdate = async (newPlayers: string[], pairs?: { player1: string; player2: string }[]) => {
    gameState.setPlayers(newPlayers);
    if (!gameConfig || !gameId) return;

    const updatedConfig = { ...gameConfig, teammatePairs: pairs };
    gameState.setGameConfig(updatedConfig);

    const preservedMatches: Match[] = [];
    const courts = Array.from(new Set(matches.map((m) => m.court)));
    for (const court of courts) {
      const courtMatches = matches.filter((m) => m.court === court);
      const completedMatches = courtMatches.filter((m) => matchScores.has(m.id));
      preservedMatches.push(...completedMatches);
      const currentMatchIndex = courtMatches.findIndex((m) => !matchScores.has(m.id));
      if (currentMatchIndex >= 0) preservedMatches.push(courtMatches[currentMatchIndex]);
    }

    let regenerateFromTime = 0;
    if (preservedMatches.length > 0) {
      regenerateFromTime = Math.max(...preservedMatches.map((m) => m.endTime));
    }

    const newSchedule = generateSchedule(
      newPlayers,
      gameConfig.gameDuration,
      gameConfig.totalTime,
      gameConfig.courts,
      undefined,
      pairs,
      gameConfig.courtConfigs as CourtConfig[] | undefined,
    ) as unknown as Match[];
    const futureMatches = newSchedule.filter((m) => m.startTime >= regenerateFromTime);
    const finalSchedule = gameState.sanitizeMatches([...preservedMatches, ...futureMatches]);

    gameState.setMatches(finalSchedule);

    try {
      const { error } = await supabase
        .from("games")
        .update({ players: newPlayers, matches: finalSchedule as any, game_config: updatedConfig as any })
        .eq("id", gameId);
      if (error) throw error;
      const preservedCount = preservedMatches.length;
      toast.success(
        preservedCount > 0
          ? `Players updated! ${preservedCount} match(es) preserved, future matches regenerated.`
          : "Schedule generated!"
      );
    } catch {
      toast.error("Failed to update players");
    }
  };

  const handleScheduleUpdate = async (newMatches: Match[], newPlayers: string[]) => {
    const sanitized = gameState.sanitizeMatches(newMatches);
    gameState.setMatches(sanitized);
    gameState.setPlayers(newPlayers);
    gameState.syncMatchScoresFromMatches(sanitized);

    if (!gameId) return;

    try {
      const { error } = await supabase.from("games").update({ matches: sanitized as any, players: newPlayers }).eq("id", gameId);
      if (error) throw error;
    } catch {
      toast.error("Failed to update game");
    }
  };

  const handleCourtConfigUpdate = async (configs: CourtConfig[]) => {
    if (!gameConfig || !gameId) return;
    const updatedConfig = { ...gameConfig, courtConfigs: configs };
    gameState.setGameConfig(updatedConfig);

    try {
      const { error } = await supabase.from("games").update({ game_config: updatedConfig as any }).eq("id", gameId);
      if (error) throw error;
    } catch {
      toast.error("Failed to update court configuration");
    }
  };

  const handleSkipMatch = async (matchId: string) => {
    if (!gameId || !identityPlayerName) return;
    try {
      await setSkipNextMatch(gameId, identityPlayerName, true);
      toast.success("You've been marked to skip this match");
      setTimeout(async () => {
        await setSkipNextMatch(gameId, identityPlayerName, false);
      }, 5 * 60 * 1000);
    } catch {
      toast.error("Failed to skip match");
    }
  };

  if (gameState.isRestoringSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading session...</p>
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
          players={players}
          onSelect={async (name) => {
            await claimIdentity(name);
            setShowPlayerSelector(false);
            toast.success(`You're now playing as ${name}!`);
          }}
          onCancel={() => setShowPlayerSelector(false)}
        />
      )}

      <Card className="p-2 sm:p-3 shadow-sport border-2 border-primary/10 backdrop-blur-sm bg-card/80 flex-1 flex flex-col min-h-0">
        {activeSection === "setup" && (
          <ClassicSetupView gameCode={gameCode} onComplete={handleSetupComplete} onNewSession={gameId ? startNewSession : undefined} />
        )}

        {activeSection === "players" && gameCode && (
          <ClassicPlayersView
            gameCode={gameCode}
            players={players}
            gameConfig={gameConfig}
            matches={matches}
            matchScores={matchScores}
            onPlayersChange={handlePlayersChange}
            onPlayersUpdate={handlePlayersUpdate}
            onNavigateToMatches={() => setActiveSection("matches")}
          />
        )}

        {activeSection === "matches" && gameConfig && (
          isIdentityPlayerView && identityPlayerName ? (
            <ClassicMyMatchesView
              playerName={identityPlayerName}
              matchGroups={playerMatches}
              matchScores={matchScores}
              currentTime={currentTime}
              allMatches={matches}
              onReleaseIdentity={() => {
                releaseIdentity();
                toast.success("Switched to organizer view");
              }}
              onSkipMatch={handleSkipMatch}
            />
          ) : (
            <ClassicMatchesView
              matches={matches}
              gameConfig={gameConfig}
              players={players}
              matchScores={matchScores}
              onMatchScoresUpdate={setMatchScores}
              onScheduleUpdate={handleScheduleUpdate}
              onCourtConfigUpdate={handleCourtConfigUpdate}
              isPlayerView={isIdentityPlayerView}
              playerName={identityPlayerName}
              onShowPlayerSelector={() => setShowPlayerSelector(true)}
            />
          )
        )}

        {activeSection === "leaderboard" && <ClassicLeaderboardView players={players} matches={matches} matchScores={matchScores} />}
        {activeSection === "history" && <ClassicHistoryView matches={matches} matchScores={matchScores} />}
      </Card>
    </AppShell>
  );
};

export default ClassicVariant;
