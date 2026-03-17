/**
 * ClassicVariant - Round-Robin Tournament Experience
 * Refactored to use the new shell foundation
 */
import React, { useEffect, useState, useRef } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

import { useShell, AppShell, ResponsiveNavigation, PlayerViewHeader } from "@/shell";
import { useViewport } from "@/core/hooks/useViewport";
import { GameCodeDialog } from "@/components/GameCodeDialog";
import { PlayerIdentitySelector } from "@/components/PlayerIdentitySelector";
import { usePlayerIdentity } from "@/hooks/use-player-identity";
import { usePlayerMatches } from "@/hooks/use-player-matches";
import { usePlayerNotifications } from "@/hooks/use-player-notifications";
import { supabase } from "@/integrations/supabase/client";
import { debugLogger } from "@/lib/debug-logger";
import { safeStorage } from "@/lib/safe-storage";
import { setSkipNextMatch } from "@/lib/player-identity";
import type { Match, GameConfig } from "@/core/types";

// Classic variant components
import { ClassicSetupView } from "./components/ClassicSetupView";
import { ClassicPlayersView } from "./components/ClassicPlayersView";
import { ClassicMatchesView } from "./components/ClassicMatchesView";
import { ClassicLeaderboardView } from "./components/ClassicLeaderboardView";
import { ClassicHistoryView } from "./components/ClassicHistoryView";
import { ClassicMyMatchesView } from "./components/ClassicMyMatchesView";

// Game state hook
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

  // Sanitize match IDs
  const sanitizeMatches = (arr: Match[]): Match[] => {
    const seen = new Map<string, number>();
    return arr.map(m => {
      let baseId = m.id && m.id.trim() !== "" ? m.id : `match-c${m.court}-t${m.startTime}`;
      const count = seen.get(baseId) || 0;
      seen.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-v${count + 1}`;
      return { ...m, id };
    });
  };

  // Auth initialization
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

  // Session restoration
  useEffect(() => {
    if (!userId || isRestoringRef.current) return;
    
    const restore = async () => {
      isRestoringRef.current = true;
      const savedGameId = safeStorage.getItem('classic_game_id');
      const savedGameCode = safeStorage.getItem('classic_game_code');
      
      if (savedGameId && savedGameCode) {
        try {
          const { data, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', savedGameId)
            .single();
            
          if (!error && data) {
            const loadedMatches = data.matches as unknown as Match[] || [];
            setGameId(data.id);
            setGameCode(data.game_code);
            setPlayers(data.players || []);
            setGameConfig(data.game_config as unknown as GameConfig);
            setMatches(sanitizeMatches(loadedMatches));
            toast.success(`Session restored: ${data.game_code}`);
          } else {
            safeStorage.removeItem('classic_game_id');
            safeStorage.removeItem('classic_game_code');
          }
        } catch (err) {
          debugLogger.log('error', 'Failed to restore session', err);
        }
      }
      
      setIsRestoringSession(false);
      isRestoringRef.current = false;
    };
    
    restore();
  }, [userId]);

  // Realtime sync
  useEffect(() => {
    if (!gameId) return;
    
    const channel = supabase
      .channel('classic-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setPlayers(updated.players || []);
            setMatches(sanitizeMatches(updated.matches as unknown as Match[] || []));
            setGameConfig(updated.game_config as unknown as GameConfig);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

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
  };
};

// Main Classic Variant Component
export const ClassicVariant: React.FC = () => {
  const navigate = useNavigate();
  const { activeSection, setActiveSection, isPlayerView, playerName, exitPlayerView, enterPlayerView } = useShell();
  const { isMobilePortrait, isMobileLandscape, isDesktop } = useViewport();
  const [showGameCodeDialog, setShowGameCodeDialog] = useState(true);
  const [showPlayerSelector, setShowPlayerSelector] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [joinMode, setJoinMode] = useState<'organizer' | 'player'>('organizer');
  
  const gameState = useClassicGameState();
  const { players, matches, gameConfig, gameId, gameCode, matchScores, setMatchScores } = gameState;
  
  // Player identity hooks
  const { playerName: identityPlayerName, isPlayerView: isIdentityPlayerView, claimIdentity, releaseIdentity } = usePlayerIdentity(gameId);
  const playerMatches = usePlayerMatches(matches, identityPlayerName, matchScores);
  
  // Notifications
  usePlayerNotifications(matches, identityPlayerName, gameId, matchScores);

  // Time updates for player view
  useEffect(() => {
    if (isIdentityPlayerView) {
      const interval = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(interval);
    }
  }, [isIdentityPlayerView]);

  // Handle URL join parameter - improved for player-first experience
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    const mode = urlParams.get('mode');
    
    if (joinCode && gameState.userId) {
      window.history.replaceState({}, '', window.location.pathname);
      
      // If mode=player, set join mode to player for better UX
      if (mode === 'player') {
        setJoinMode('player');
      }
      
      joinExistingGame(joinCode);
    }
  }, [gameState.userId]);

  const joinExistingGame = async (code: string) => {
    if (!gameState.userId) {
      toast.error('Please wait for authentication');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('game_code', code)
        .single();
        
      if (error || !data) {
        toast.error("Game not found");
        return;
      }
      
      gameState.setGameId(data.id);
      gameState.setGameCode(data.game_code);
      gameState.setPlayers(data.players || []);
      gameState.setGameConfig(data.game_config as unknown as GameConfig);
      gameState.setMatches(gameState.sanitizeMatches(data.matches as unknown as Match[] || []));
      
      safeStorage.setItem('classic_game_id', data.id);
      safeStorage.setItem('classic_game_code', data.game_code);
      setShowGameCodeDialog(false);
      toast.success(`Joined game: ${code}`);
    } catch (err) {
      toast.error("Failed to join game");
    }
  };

  const createNewGame = () => {
    safeStorage.removeItem('classic_game_id');
    safeStorage.removeItem('classic_game_code');
    setShowGameCodeDialog(false);
    setActiveSection('setup');
  };

  const startNewSession = () => {
    safeStorage.removeItem('classic_game_id');
    safeStorage.removeItem('classic_game_code');
    gameState.setPlayers([]);
    gameState.setMatches([]);
    gameState.setGameConfig(null);
    gameState.setGameId(null);
    gameState.setGameCode("");
    gameState.setSetupComplete(false);
    setMatchScores(new Map());
    setShowGameCodeDialog(false);
    toast.success("New session started");
  };

  const handleSetupComplete = async (config: GameConfig) => {
    if (!gameState.userId) {
      toast.error('Please wait for authentication');
      return;
    }
    
    gameState.setGameConfig(config);
    gameState.setSetupComplete(true);
    
    try {
      const { data: codeData } = await supabase.rpc('generate_game_code');
      const newGameCode = codeData as string;
      
      const { data, error } = await supabase
        .from('games')
        .insert([{
          game_code: newGameCode,
          game_config: config as any,
          players: [],
          matches: [],
          creator_id: gameState.userId
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      gameState.setGameId(data.id);
      gameState.setGameCode(newGameCode);
      safeStorage.setItem('classic_game_id', data.id);
      safeStorage.setItem('classic_game_code', newGameCode);
      toast.success(`Game created! Code: ${newGameCode}`);
      setActiveSection('players');
    } catch (err) {
      toast.error("Failed to create game");
    }
  };

  // Loading state
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
      bottomNav={
        <ResponsiveNavigation 
          disabled={showGameCodeDialog}
        />
      }
    >
      {/* Game Code Dialog */}
      <GameCodeDialog 
        open={showGameCodeDialog} 
        onOpenChange={setShowGameCodeDialog}
        onJoinGame={joinExistingGame}
        onCreateGame={createNewGame}
      />

      {/* Player Identity Selector */}
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

      {/* Main Content Card */}
      <Card className="p-2 sm:p-3 shadow-sport border-2 border-primary/10 backdrop-blur-sm bg-card/80 flex-1 flex flex-col min-h-0 mb-14">
        {activeSection === 'setup' && (
          <ClassicSetupView
            gameCode={gameCode}
            onComplete={handleSetupComplete}
            onNewSession={gameId ? startNewSession : undefined}
          />
        )}

        {activeSection === 'players' && gameCode && (
          <ClassicPlayersView
            gameCode={gameCode}
            players={players}
            gameConfig={gameConfig}
            matches={matches}
            matchScores={matchScores}
            onPlayersChange={(newPlayers, pairs) => {
              gameState.setPlayers(newPlayers);
              if (gameConfig && gameId) {
                const updatedConfig = { ...gameConfig, teammatePairs: pairs };
                gameState.setGameConfig(updatedConfig);
                supabase.from('games').update({
                  players: newPlayers,
                  game_config: updatedConfig as any
                }).eq('id', gameId);
              }
            }}
            onNavigateToMatches={() => setActiveSection('matches')}
          />
        )}

        {activeSection === 'matches' && gameConfig && (
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
              onSkipMatch={(matchId) => {
                // Handle skip logic
                toast.info("Skip match feature coming soon");
              }}
            />
          ) : (
            <ClassicMatchesView
              matches={matches}
              gameConfig={gameConfig}
              players={players}
              matchScores={matchScores}
              onMatchScoresUpdate={setMatchScores}
              isPlayerView={isIdentityPlayerView}
              playerName={identityPlayerName}
              onShowPlayerSelector={() => setShowPlayerSelector(true)}
            />
          )
        )}

        {activeSection === 'leaderboard' && (
          <ClassicLeaderboardView
            players={players}
            matches={matches}
            matchScores={matchScores}
          />
        )}

        {activeSection === 'history' && (
          <ClassicHistoryView
            matches={matches}
            matchScores={matchScores}
          />
        )}
      </Card>
    </AppShell>
  );
};

export default ClassicVariant;
