import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameSetup, GameConfig } from "@/components/GameSetup";
import { GameCodeDialog } from "@/components/GameCodeDialog";
import { ScheduleView } from "@/components/ScheduleView";
import { CheckInOut } from "@/components/CheckInOut";
import { BottomNav } from "@/components/BottomNav";
import { generateSchedule, Match } from "@/lib/scheduler";
import { Trophy, Users, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Leaderboard } from "@/components/Leaderboard";
import { MatchHistory } from "@/components/MatchHistory";
import { usePlayerIdentity } from "@/hooks/use-player-identity";
import { usePlayerMatches } from "@/hooks/use-player-matches";
import { usePlayerNotifications } from "@/hooks/use-player-notifications";
import { PlayerIdentitySelector } from "@/components/PlayerIdentitySelector";
import { MyMatchesView } from "@/components/MyMatchesView";
type Section = "setup" | "players" | "matches" | "history" | "leaderboard";
const Index = () => {
  const [activeSection, setActiveSection] = useState<Section>("setup");
  const [players, setPlayers] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameCode, setGameCode] = useState<string>("");
  const [showGameCodeDialog, setShowGameCodeDialog] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [matchScores, setMatchScores] = useState<Map<string, {
    team1: number;
    team2: number;
  }>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [showPlayerIdentitySelector, setShowPlayerIdentitySelector] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Player identity and view management
  const {
    playerName,
    isPlayerView,
    claimIdentity,
    releaseIdentity
  } = usePlayerIdentity(gameId);
  const playerMatches = usePlayerMatches(matches, playerName, matchScores);

  // Enable notifications when in player view
  usePlayerNotifications(matches, playerName, gameId, matchScores);

  // Update current time every second for player view
  useEffect(() => {
    if (isPlayerView) {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlayerView]);

  // Ensure every match has a stable, unique id to prevent key collisions and score mismatches
  const sanitizeMatches = (arr: Match[]): Match[] => {
    const seen = new Map<string, number>();
    return arr.map(m => {
      let baseId = m.id && m.id.trim() !== "" ? m.id : `match-c${m.court}-t${m.startTime}`;
      const count = seen.get(baseId) || 0;
      seen.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-v${count + 1}`;
      return {
        ...m,
        id
      };
    });
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedGameId = localStorage.getItem('teamup_game_id');
      const savedGameCode = localStorage.getItem('teamup_game_code');
      if (savedGameId && savedGameCode) {
        try {
          const {
            data,
            error
          } = await supabase.from('games').select('*').eq('id', savedGameId).single();
          if (!error && data) {
            const loadedMatches = data.matches as unknown as Match[] || [];
            const sanitized = sanitizeMatches(loadedMatches);
            setGameId(data.id);
            setGameCode(data.game_code);
            setPlayers(data.players || []);
            setGameConfig(data.game_config as unknown as GameConfig);
            setMatches(sanitized);
            syncMatchScoresFromMatches(sanitized);
            setShowGameCodeDialog(false);
            if (data.game_config) {
              setSetupComplete(true);
            }
            if (loadedMatches.length > 0) {
              setActiveSection("matches");
            } else if (data.players && data.players.length > 0) {
              setActiveSection("players");
            } else {
              setActiveSection("setup");
            }
            toast.success(`Session restored: ${data.game_code}`);
          } else {
            // Session not found in DB, clear localStorage
            localStorage.removeItem('teamup_game_id');
            localStorage.removeItem('teamup_game_code');
          }
        } catch (error) {
          console.error('Failed to restore session:', error);
          localStorage.removeItem('teamup_game_id');
          localStorage.removeItem('teamup_game_code');
        }
      }
      setIsRestoringSession(false);
    };
    if (userId) {
      restoreSession();
    } else if (userId === null) {
      // No user yet, but we know auth check completed with no session
      setIsRestoringSession(false);
    }
  }, [userId]);

  // Handle URL parameter for joining via shared link
  useEffect(() => {
    if (!userId) return;
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    if (joinCode) {
      // Remove the parameter from URL without reload
      window.history.replaceState({}, '', window.location.pathname);

      // Join the game
      joinExistingGame(joinCode);
    }
  }, [userId]);

  // Initialize anonymous authentication
  useEffect(() => {
    const initAuth = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        const {
          data,
          error
        } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('Anonymous auth error:', error);
          toast.error('Failed to initialize app');
          return;
        }
        setUserId(data.user?.id || null);
      } else {
        setUserId(session.user.id);
      }
    };
    initAuth();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);
  // Sync state from database matches
  const syncMatchScoresFromMatches = (matches: Match[]) => {
    const scoresMap = new Map<string, {
      team1: number;
      team2: number;
    }>();
    matches.forEach(match => {
      if (match.score) {
        scoresMap.set(match.id, match.score);
      }
    });
    setMatchScores(scoresMap);
  };
  useEffect(() => {
    if (!gameId) return;
    const channel = supabase.channel('game-updates').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'games',
      filter: `id=eq.${gameId}`
    }, payload => {
      if (payload.eventType === 'UPDATE') {
        const updatedGame = payload.new;
        const newMatches = updatedGame.matches as unknown as Match[] || [];
        const newPlayers = updatedGame.players || [];
        const newConfig = updatedGame.game_config as unknown as GameConfig;
        const sanitized = sanitizeMatches(newMatches);
        setPlayers(newPlayers);
        setMatches(sanitized);
        setGameConfig(newConfig);
        syncMatchScoresFromMatches(sanitized);
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);
  const createNewGame = async () => {
    // Clear any existing session
    localStorage.removeItem('teamup_game_id');
    localStorage.removeItem('teamup_game_code');
    setShowGameCodeDialog(false);
    setActiveSection("setup");
  };
  const joinExistingGame = async (code: string) => {
    if (!userId) {
      toast.error('Please wait for authentication to complete');
      return;
    }
    try {
      const {
        data,
        error
      } = await supabase.from('games').select('*').eq('game_code', code).single();
      if (error || !data) {
        toast.error("Game not found. Please check the code and try again.");
        return;
      }
      const loadedMatches = data.matches as unknown as Match[] || [];
      const sanitized = sanitizeMatches(loadedMatches);
      setGameId(data.id);
      setGameCode(data.game_code);
      setPlayers(data.players || []);
      setGameConfig(data.game_config as unknown as GameConfig);
      setMatches(sanitized);
      syncMatchScoresFromMatches(sanitized);
      setShowGameCodeDialog(false);

      // Save session to localStorage
      localStorage.setItem('teamup_game_id', data.id);
      localStorage.setItem('teamup_game_code', data.game_code);
      if (data.game_config) {
        setSetupComplete(true);
      }
      if (loadedMatches.length > 0) {
        setActiveSection("matches");
      } else {
        setActiveSection("setup");
      }
      toast.success(`Joined game: ${code}`);
    } catch (error) {
      toast.error("Failed to join game");
      console.error(error);
    }
  };
  const handleGameConfigComplete = async (config: GameConfig) => {
    if (!userId) {
      toast.error('Please wait for authentication to complete');
      return;
    }
    setGameConfig(config);
    setSetupComplete(true);
    try {
      if (gameId) {
        const {
          error
        } = await supabase.from('games').update({
          game_config: config as any
        }).eq('id', gameId);
        if (error) throw error;
      } else {
        const {
          data: codeData
        } = await supabase.rpc('generate_game_code');
        const newGameCode = codeData as string;
        const {
          data,
          error
        } = await supabase.from('games').insert([{
          game_code: newGameCode,
          game_config: config as any,
          players: [],
          matches: [],
          creator_id: userId
        }]).select().single();
        if (error) throw error;
        setGameId(data.id);
        setGameCode(newGameCode);

        // Save session to localStorage
        localStorage.setItem('teamup_game_id', data.id);
        localStorage.setItem('teamup_game_code', newGameCode);
        toast.success(`Game created! Code: ${newGameCode}`);
      }
      setActiveSection("players");
    } catch (error) {
      toast.error("Failed to save game");
      console.error(error);
    }
  };
  const handlePlayersUpdate = async (playerList: string[], teammatePairs?: {
    player1: string;
    player2: string;
  }[]) => {
    setPlayers(playerList);
    if (!gameConfig) return;
    const updatedConfig = {
      ...gameConfig,
      teammatePairs
    };
    setGameConfig(updatedConfig);

    // Identify matches to preserve: completed (with scores) + current matches (first without score on each court)
    const preservedMatches: Match[] = [];
    const courts = Array.from(new Set(matches.map(m => m.court)));
    for (const court of courts) {
      const courtMatches = matches.filter(m => m.court === court);

      // Add all completed matches (with scores)
      const completedMatches = courtMatches.filter(m => matchScores.has(m.id));
      preservedMatches.push(...completedMatches);

      // Add current match (first without score)
      const currentMatchIndex = courtMatches.findIndex(m => !matchScores.has(m.id));
      if (currentMatchIndex >= 0) {
        preservedMatches.push(courtMatches[currentMatchIndex]);
      }
    }

    // Find the earliest time slot to start regeneration from
    let regenerateFromTime = 0;
    if (preservedMatches.length > 0) {
      const maxPreservedEndTime = Math.max(...preservedMatches.map(m => m.endTime));
      regenerateFromTime = maxPreservedEndTime;
    }

    // Generate new schedule
    const newSchedule = generateSchedule(playerList, gameConfig.gameDuration, gameConfig.totalTime, gameConfig.courts, undefined, teammatePairs, gameConfig.courtConfigs);

    // Filter new schedule to only include matches after regeneration point
    const futureMatches = newSchedule.filter(m => m.startTime >= regenerateFromTime);

    // Combine preserved matches with future matches
    const finalSchedule = [...preservedMatches, ...futureMatches];
    setMatches(finalSchedule);
    try {
      if (gameId) {
        const {
          error
        } = await supabase.from('games').update({
          players: playerList,
          matches: finalSchedule as any,
          game_config: updatedConfig as any
        }).eq('id', gameId);
        if (error) throw error;
        const preservedCount = preservedMatches.length;
        const message = preservedCount > 0 ? `Players updated! ${preservedCount} match(es) preserved, future matches regenerated.` : "Schedule generated!";
        toast.success(message);
      }
    } catch (error) {
      toast.error("Failed to update players");
      console.error(error);
    }
  };
  const handleScheduleUpdate = async (newMatches: Match[], newPlayers: string[]) => {
    // Sanitize IDs before saving to avoid duplicates
    const sanitized = sanitizeMatches(newMatches);
    setMatches(sanitized);
    setPlayers(newPlayers);
    if (gameId) {
      try {
        const {
          error
        } = await supabase.from('games').update({
          matches: sanitized as any,
          players: newPlayers
        }).eq('id', gameId);
        if (error) throw error;
      } catch (error) {
        toast.error("Failed to update game");
        console.error(error);
      }
    }
  };
  const handleCourtConfigUpdate = async (courtConfigs: any[]) => {
    if (!gameConfig) return;
    const updatedConfig = {
      ...gameConfig,
      courtConfigs
    };
    setGameConfig(updatedConfig);
    if (gameId) {
      try {
        const {
          error
        } = await supabase.from('games').update({
          game_config: updatedConfig as any
        }).eq('id', gameId);
        if (error) throw error;
      } catch (error) {
        toast.error("Failed to update court configuration");
        console.error(error);
      }
    }
  };
  const resetApp = () => {
    setActiveSection("setup");
    setPlayers([]);
    setMatches([]);
    setGameConfig(null);
    setGameId(null);
    setGameCode("");
    setSetupComplete(false);
    setShowGameCodeDialog(true);
  };
  const startNewSession = () => {
    // Clear localStorage
    localStorage.removeItem('teamup_game_id');
    localStorage.removeItem('teamup_game_code');

    // Reset all state
    setActiveSection("setup");
    setPlayers([]);
    setMatches([]);
    setGameConfig(null);
    setGameId(null);
    setGameCode("");
    setSetupComplete(false);
    setMatchScores(new Map());
    setShowGameCodeDialog(false);
    toast.success("New session started");
  };
  // Show loading state while restoring session
  if (isRestoringSession) {
    return <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Trophy className="w-8 h-8 text-white" />
        </div>
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    </div>;
  }
  return <div className="h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/5 relative flex flex-col">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-20 right-10 w-64 h-64 bg-primary rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent rounded-full blur-3xl"></div>
      </div>
      
      <div className="max-w-5xl mx-auto p-2 sm:p-3 w-full relative z-10 flex flex-col h-full min-h-0">
        <header className="text-center py-2 sm:py-3 flex-shrink-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-[gradient_6s_linear_infinite]">
            TeamUp! Social Play
          </h1>
          <p className="text-muted-foreground text-[10px] sm:text-xs md:text-sm font-medium leading-relaxed px-2 sm:px-0">🎾 Smart team assignment & scoring. Live match scheduling with multi-court management, real-time scoring, and smart team rotation. 🏓</p>
        </header>

        <GameCodeDialog open={showGameCodeDialog} onOpenChange={setShowGameCodeDialog} onJoinGame={joinExistingGame} onCreateGame={createNewGame} />

        <Card className="p-2 sm:p-3 shadow-sport border-2 border-primary/10 backdrop-blur-sm bg-card/80 flex-1 flex flex-col min-h-0 mb-14">
          {activeSection === "setup" && <div className="flex flex-col h-full">
              {gameId && <div className="flex justify-end mb-2">
                  <Button onClick={startNewSession} variant="outline" size="sm" className="gap-1 h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3">
                    New Session
                  </Button>
                </div>}
              <div className="flex-1 overflow-y-auto">
                <GameSetup onComplete={handleGameConfigComplete} gameCode={gameCode} />
              </div>
              <div className="pt-2 sm:pt-3 border-t mt-2 sm:mt-3 flex-shrink-0 bg-card/95 backdrop-blur-sm">
                
              </div>
            </div>}
          
          {activeSection === "matches" && gameConfig && matches.length > 0 && <div className="flex flex-col h-full min-h-0">
              {/* View Toggle Header */}
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {isPlayerView && playerName ? <>
                      <UserCircle className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Playing as: <span className="text-primary font-bold">{playerName}</span></span>
                    </> : <>
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Organizer View</span>
                    </>}
                </div>
                <Button variant={isPlayerView ? "outline" : "default"} size="sm" onClick={() => {
              if (isPlayerView) {
                releaseIdentity();
                toast.success("Switched to organizer view");
              } else {
                setShowPlayerIdentitySelector(true);
              }
            }} className="gap-2">
                  {isPlayerView ? <>
                      <Users className="h-4 w-4" />
                      Organizer View
                    </> : <>
                      <UserCircle className="h-4 w-4" />
                      Player View
                    </>}
                </Button>
              </div>

              {/* Conditional View Rendering */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {isPlayerView && playerName ? <MyMatchesView playerName={playerName} matchGroups={playerMatches} matchScores={matchScores} currentTime={currentTime} allMatches={matches} /> : <ScheduleView matches={matches} onBack={resetApp} gameConfig={gameConfig} allPlayers={players} onScheduleUpdate={handleScheduleUpdate} matchScores={matchScores} onMatchScoresUpdate={setMatchScores} onCourtConfigUpdate={handleCourtConfigUpdate} />}
              </div>
            </div>}

          {/* Player Identity Selector Dialog */}
          {showPlayerIdentitySelector && <PlayerIdentitySelector players={players} onSelect={async name => {
          await claimIdentity(name);
          setShowPlayerIdentitySelector(false);
          toast.success(`You're now playing as ${name}!`);
        }} onCancel={() => setShowPlayerIdentitySelector(false)} />}

          {activeSection === "matches" && (!gameConfig || matches.length === 0) && <div className="text-center py-12">
              <p className="text-muted-foreground">Please complete game setup and add players first</p>
            </div>}

          {activeSection === "players" && gameCode && <div className="flex-1 min-h-0 h-full">
              <CheckInOut gameCode={gameCode} players={players} onPlayersUpdate={handlePlayersUpdate} matches={matches} matchScores={matchScores} teammatePairs={gameConfig?.teammatePairs} onNavigateToMatches={() => setActiveSection("matches")} hasStartedMatches={matches.length > 0} />
            </div>}

          {activeSection === "players" && !gameCode && <div className="text-center py-12">
              <p className="text-muted-foreground">Please complete game setup first</p>
            </div>}

          {activeSection === "history" && <div className="flex-1 min-h-0">
              <MatchHistory matches={matches} matchScores={matchScores} />
            </div>}

          {activeSection === "leaderboard" && <div className="flex-1 min-h-0">
              <div className="flex flex-col h-full">
                <div className="text-center mb-3 flex-shrink-0">
                  
                  
                </div>
                {matchScores.size > 0 ? <Leaderboard players={players} matches={matches} matchScores={matchScores} /> : <div className="text-center py-12">
                    <p className="text-muted-foreground">No completed matches yet</p>
                  </div>}
              </div>
            </div>}
        </Card>
      </div>

      <BottomNav activeSection={activeSection} onSectionChange={setActiveSection} disabled={showGameCodeDialog} />
    </div>;
};
export default Index;