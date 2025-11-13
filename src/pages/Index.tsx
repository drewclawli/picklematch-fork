import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameSetup, GameConfig } from "@/components/GameSetup";
import { GameCodeDialog } from "@/components/GameCodeDialog";
import { ScheduleView } from "@/components/ScheduleView";
import { CheckInOut } from "@/components/CheckInOut";
import { BottomNav } from "@/components/BottomNav";
import { generateSchedule, Match } from "@/lib/scheduler";
import { Trophy, Users, UserCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Leaderboard } from "@/components/Leaderboard";
import { MatchHistory } from "@/components/MatchHistory";
import { usePlayerIdentity } from "@/hooks/use-player-identity";
import { usePlayerMatches } from "@/hooks/use-player-matches";
import { usePlayerNotifications } from "@/hooks/use-player-notifications";
import { PlayerIdentitySelector } from "@/components/PlayerIdentitySelector";
import logo from "@/assets/logo.png";
import { MyMatchesView } from "@/components/MyMatchesView";
import { debugLogger } from "@/lib/debug-logger";
import { safeStorage } from "@/lib/safe-storage";
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
  const [unexpectedReload, setUnexpectedReload] = useState(false);
  
  // Refs for preventing duplicate operations
  const isRestoringRef = useRef(false);
  const authInitializedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);

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

  // Track page load to detect unexpected reloads
  useEffect(() => {
    debugLogger.log('lifecycle', 'Component mounted', {
      userAgent: navigator.userAgent,
      isAndroid: /android/i.test(navigator.userAgent),
      sessionId: Date.now()
    });

    // Check if this is an unexpected reload
    const lastActivity = safeStorage.getItem('last_activity');
    if (lastActivity) {
      const timeSinceActivity = Date.now() - parseInt(lastActivity);
      if (timeSinceActivity < 5000) {
        debugLogger.log('error', 'Unexpected reload detected', { timeSinceActivity });
        setUnexpectedReload(true);
      }
    }

    // Update activity timestamp periodically
    const activityInterval = setInterval(() => {
      safeStorage.setItem('last_activity', Date.now().toString());
    }, 2000);

    return () => {
      clearInterval(activityInterval);
      debugLogger.log('lifecycle', 'Component unmounted');
    };
  }, []);

  // Visibility API handler - pause operations when hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        debugLogger.log('lifecycle', 'App hidden');
      } else {
        debugLogger.log('lifecycle', 'App visible');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Restore session from localStorage on mount with stability checks
  useEffect(() => {
    const restoreSession = async () => {
      // Prevent duplicate restoration
      if (isRestoringRef.current) {
        debugLogger.log('lifecycle', 'Session restoration already in progress, skipping');
        return;
      }
      isRestoringRef.current = true;
      
      debugLogger.log('lifecycle', 'Starting session restoration');
      
      const savedGameId = safeStorage.getItem('teamup_game_id');
      const savedGameCode = safeStorage.getItem('teamup_game_code');
      if (savedGameId && savedGameCode) {
        try {
          debugLogger.log('lifecycle', 'Found saved session', { gameId: savedGameId, gameCode: savedGameCode });
          
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
            debugLogger.log('lifecycle', 'Session restored successfully');
            toast.success(`Session restored: ${data.game_code}`);
          } else {
            // Session not found in DB, clear storage
            debugLogger.log('lifecycle', 'Session not found in DB, clearing');
            safeStorage.removeItem('teamup_game_id');
            safeStorage.removeItem('teamup_game_code');
          }
        } catch (error) {
          debugLogger.log('error', 'Failed to restore session', error);
          console.error('Failed to restore session:', error);
          safeStorage.removeItem('teamup_game_id');
          safeStorage.removeItem('teamup_game_code');
          toast.error('Failed to restore session');
        }
      }
      setIsRestoringSession(false);
      isRestoringRef.current = false;
    };
    
    if (userId) {
      restoreSession();
    } else if (userId === null) {
      // No user yet, but we know auth check completed with no session
      debugLogger.log('lifecycle', 'No user session, skipping restoration');
      setIsRestoringSession(false);
      isRestoringRef.current = false;
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

  // Initialize anonymous authentication with error boundaries
  useEffect(() => {
    if (authInitializedRef.current) {
      debugLogger.log('auth', 'Auth already initialized, skipping');
      return;
    }
    authInitializedRef.current = true;

    const initAuth = async () => {
      try {
        debugLogger.log('auth', 'Starting auth initialization');
        
        const {
          data: {
            session
          }
        } = await supabase.auth.getSession();
        
        if (!session) {
          debugLogger.log('auth', 'No existing session, signing in anonymously');
          const {
            data,
            error
          } = await supabase.auth.signInAnonymously();
          if (error) {
            debugLogger.log('error', 'Anonymous auth error', error);
            console.error('Anonymous auth error:', error);
            toast.error('Failed to initialize app');
            return;
          }
          setUserId(data.user?.id || null);
          debugLogger.log('auth', 'Anonymous sign in successful', { userId: data.user?.id });
        } else {
          setUserId(session.user.id);
          debugLogger.log('auth', 'Existing session found', { userId: session.user.id });
        }
      } catch (error) {
        debugLogger.log('error', 'Auth initialization failed', error);
        console.error('Auth initialization failed:', error);
        toast.error('Failed to initialize authentication');
      }
    };
    
    initAuth();
    
    // Debounced auth state change handler
    let authChangeTimeout: NodeJS.Timeout;
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(authChangeTimeout);
      authChangeTimeout = setTimeout(() => {
        debugLogger.log('auth', 'Auth state changed', { event, userId: session?.user?.id });
        setUserId(session?.user?.id || null);
      }, 300);
    });
    
    return () => {
      clearTimeout(authChangeTimeout);
      subscription.unsubscribe();
      debugLogger.log('auth', 'Auth subscription cleaned up');
    };
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
  // Realtime subscription with error boundaries and reconnection
  useEffect(() => {
    if (!gameId) return;
    
    // Clean up existing subscription
    if (subscriptionRef.current) {
      debugLogger.log('subscription', 'Cleaning up existing subscription');
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
    
    debugLogger.log('subscription', 'Setting up realtime subscription', { gameId });
    
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000;
    
    const setupSubscription = () => {
      try {
        const channel = supabase.channel('game-updates').on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        }, payload => {
          try {
            debugLogger.log('subscription', 'Received update', { eventType: payload.eventType });
            
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
          } catch (error) {
            debugLogger.log('error', 'Failed to process subscription update', error);
            console.error('Subscription update error:', error);
          }
        }).subscribe((status, err) => {
          debugLogger.log('subscription', 'Subscription status changed', { status, error: err });
          
          if (status === 'CHANNEL_ERROR' && retryCount < maxRetries) {
            retryCount++;
            debugLogger.log('subscription', 'Retrying subscription', { retryCount });
            setTimeout(setupSubscription, retryDelay * retryCount);
          }
        });
        
        subscriptionRef.current = channel;
      } catch (error) {
        debugLogger.log('error', 'Failed to setup subscription', error);
        console.error('Subscription setup error:', error);
      }
    };
    
    setupSubscription();
    
    return () => {
      if (subscriptionRef.current) {
        debugLogger.log('subscription', 'Cleaning up subscription on unmount');
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [gameId]);
  const createNewGame = async () => {
    // Clear any existing session
    debugLogger.log('lifecycle', 'Creating new game');
    safeStorage.removeItem('teamup_game_id');
    safeStorage.removeItem('teamup_game_code');
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

      // Save session to storage
      safeStorage.setItem('teamup_game_id', data.id);
      safeStorage.setItem('teamup_game_code', data.game_code);
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

        // Save session to storage
        safeStorage.setItem('teamup_game_id', data.id);
        safeStorage.setItem('teamup_game_code', newGameCode);
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

    // Check if tournament mode
    if (gameConfig.schedulingType && gameConfig.schedulingType !== 'round-robin') {
      // Validate even player count for doubles tournaments
      if (gameConfig.tournamentPlayStyle === 'doubles' && playerList.length % 2 !== 0) {
        toast.error("Doubles tournaments require an even number of players. Please add or remove one player.");
        return;
      }

      // Enforce 4/8/16 teams for single or double elimination (validate on Players page)
      if (gameConfig.schedulingType === 'single-elimination' || gameConfig.schedulingType === 'double-elimination') {
        const teamCount = gameConfig.tournamentPlayStyle === 'doubles' ? playerList.length / 2 : playerList.length;
        if (![4, 8, 16].includes(teamCount)) {
          const requiredText = gameConfig.tournamentPlayStyle === 'singles' ? '4, 8, or 16 players' : '8, 16, or 32 players (to form 4, 8, or 16 teams)';
          toast.error(`${gameConfig.schedulingType === 'single-elimination' ? 'Single' : 'Double'} elimination requires exactly ${requiredText}.`);
          return;
        }
      }

      // Tournament mode - generate complete bracket
      const isQualifierMode = gameConfig.schedulingType === 'qualifier-tournament';
      if (isQualifierMode) {
        const {
          generateQualifierTournamentSchedule
        } = await import('@/lib/qualifier-tournament-scheduler');
        const {
          advanceGroupWinnersToKnockout
        } = await import('@/lib/qualifier-progression');
        try {
          let newSchedule = generateQualifierTournamentSchedule(playerList, gameConfig.gameDuration, gameConfig.courts, gameConfig.courtConfigs || [], teammatePairs || [], gameConfig.tournamentPlayStyle === 'singles');
          setMatches(newSchedule);
          if (gameId) {
            const {
              error
            } = await supabase.from('games').update({
              players: playerList,
              matches: newSchedule as any,
              game_config: updatedConfig as any
            }).eq('id', gameId);
            if (error) throw error;
            toast.success("Qualifier tournament generated!");
          }
        } catch (error: any) {
          toast.error(error.message || "Failed to generate qualifier tournament");
          console.error(error);
        }
        return;
      }
      const {
        generateTournamentSchedule
      } = await import('@/lib/tournament-scheduler');
      const {
        processByeMatches
      } = await import('@/lib/tournament-progression');
      try {
        let newSchedule = generateTournamentSchedule(playerList, gameConfig.gameDuration, gameConfig.courts, gameConfig.schedulingType, gameConfig.courtConfigs || [], teammatePairs || [], gameConfig.tournamentPlayStyle === 'singles');

        // Process bye matches
        newSchedule = processByeMatches(newSchedule);
        setMatches(newSchedule);
        if (gameId) {
          const {
            error
          } = await supabase.from('games').update({
            players: playerList,
            matches: newSchedule as any,
            game_config: updatedConfig as any
          }).eq('id', gameId);
          if (error) throw error;
          toast.success("Tournament bracket generated!");
        }
      } catch (error: any) {
        toast.error(error.message || "Failed to generate tournament");
        console.error(error);
      }
      return;
    }

    // Round-robin mode - preserve matches and regenerate
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
    // Clear storage
    debugLogger.log('lifecycle', 'Starting new session');
    safeStorage.removeItem('teamup_game_id');
    safeStorage.removeItem('teamup_game_code');

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
    setUnexpectedReload(false);
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
      {/* Unexpected reload warning */}
      {unexpectedReload && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md">
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive mb-2">
                Unexpected reload detected
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const logs = debugLogger.exportLogs();
                    const blob = new Blob([logs], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `debug-logs-${Date.now()}.json`;
                    a.click();
                    toast.success('Debug logs exported');
                  }}
                >
                  Export Logs
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setUnexpectedReload(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-20 right-10 w-64 h-64 bg-primary rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent rounded-full blur-3xl"></div>
      </div>

      {/* Left Ad Sidebar - Desktop Only */}
      <div className="hidden xl:block fixed left-2 top-1/2 -translate-y-1/2 w-40 z-20">
        <ins className="adsbygoogle"
             style={{ display: 'block' }}
             data-ad-client="ca-pub-6788044289759238"
             data-ad-slot="3260817680"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        <script dangerouslySetInnerHTML={{
          __html: '(adsbygoogle = window.adsbygoogle || []).push({});'
        }} />
      </div>

      {/* Right Ad Sidebar - Desktop Only */}
      <div className="hidden xl:block fixed right-2 top-1/2 -translate-y-1/2 w-40 z-20">
        <ins className="adsbygoogle"
             style={{ display: 'block' }}
             data-ad-client="ca-pub-6788044289759238"
             data-ad-slot="3560485991"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        <script dangerouslySetInnerHTML={{
          __html: '(adsbygoogle = window.adsbygoogle || []).push({});'
        }} />
      </div>
      
      <div className="max-w-5xl mx-auto p-2 sm:p-3 w-full relative z-10 flex flex-col h-full min-h-0">
        <header className="text-center py-2 sm:py-3 flex-shrink-0">
          <div className="flex items-center justify-center mb-2">
            <img src={logo} alt="PickleballMatch.Fun" className="h-10 sm:h-12 md:h-14 w-auto" />
          </div>
          <p className="text-muted-foreground text-[10px] sm:text-xs md:text-sm font-medium leading-relaxed px-2 sm:px-0">🎾 Smart team assignment & scoring. Live match scheduling with multi-court management, real-time scoring, and smart team rotation. 🏓</p>
        </header>

        <GameCodeDialog open={showGameCodeDialog} onOpenChange={setShowGameCodeDialog} onJoinGame={joinExistingGame} onCreateGame={createNewGame} />

        <Card className="p-2 sm:p-3 shadow-sport border-2 border-primary/10 backdrop-blur-sm bg-card/80 flex-1 flex flex-col min-h-0 mb-14">
          {activeSection === "setup" && <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto">
                <GameSetup 
                  onComplete={handleGameConfigComplete} 
                  gameCode={gameCode} 
                  onNewSession={gameId ? startNewSession : undefined}
                  hasExistingMatches={matches.length > 0}
                />
              </div>
              <div className="pt-2 sm:pt-3 border-t mt-2 sm:mt-3 flex-shrink-0 bg-card/95 backdrop-blur-sm">
                
              </div>
            </div>}
          
          {activeSection === "matches" && gameConfig && matches.length > 0 && <div className="flex flex-col h-full min-h-0">
              {/* Conditional View Rendering */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {isPlayerView && playerName ? <MyMatchesView playerName={playerName} matchGroups={playerMatches} matchScores={matchScores} currentTime={currentTime} allMatches={matches} onReleaseIdentity={() => {
              releaseIdentity();
              toast.success("Switched to organizer view");
            }} /> : <ScheduleView matches={matches} onBack={resetApp} gameConfig={gameConfig} allPlayers={players} onScheduleUpdate={handleScheduleUpdate} matchScores={matchScores} onMatchScoresUpdate={setMatchScores} onCourtConfigUpdate={handleCourtConfigUpdate} isPlayerView={isPlayerView} playerName={playerName} onReleaseIdentity={() => {
              releaseIdentity();
              toast.success("Switched to organizer view");
            }} onShowPlayerSelector={() => setShowPlayerIdentitySelector(true)} />}
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