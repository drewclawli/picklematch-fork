import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { GameSetup, GameConfig } from "@/components/GameSetup";
import { GameCodeDialog } from "@/components/GameCodeDialog";
import { ScheduleView } from "@/components/ScheduleView";
import { CheckInOut } from "@/components/CheckInOut";
import { BottomNav } from "@/components/BottomNav";
import { generateSchedule, Match } from "@/lib/scheduler";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
type Section = "setup" | "scheduler" | "checkin";
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
        setPlayers(updatedGame.players || []);
        setMatches(updatedGame.matches as unknown as Match[] || []);
        setGameConfig(updatedGame.game_config as unknown as GameConfig);
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);
  const createNewGame = async () => {
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
      setGameId(data.id);
      setGameCode(data.game_code);
      setPlayers(data.players || []);
      setGameConfig(data.game_config as unknown as GameConfig);
      setMatches(data.matches as unknown as Match[] || []);
      setShowGameCodeDialog(false);
      if (data.game_config) {
        setSetupComplete(true);
      }
      if (data.matches && Array.isArray(data.matches) && data.matches.length > 0) {
        setActiveSection("scheduler");
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
        toast.success(`Game created! Code: ${newGameCode}`);
      }
      setActiveSection("checkin");
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
    const schedule = generateSchedule(playerList, gameConfig.gameDuration, gameConfig.totalTime, gameConfig.courts, undefined, teammatePairs, gameConfig.courtConfigs);
    setMatches(schedule);
    try {
      if (gameId) {
        const {
          error
        } = await supabase.from('games').update({
          players: playerList,
          matches: schedule as any,
          game_config: updatedConfig as any
        }).eq('id', gameId);
        if (error) throw error;
        toast.success("Schedule generated!");
      }
    } catch (error) {
      toast.error("Failed to update players");
      console.error(error);
    }
  };
  const handleScheduleUpdate = async (newMatches: Match[], newPlayers: string[]) => {
    setMatches(newMatches);
    setPlayers(newPlayers);
    if (gameId) {
      try {
        const {
          error
        } = await supabase.from('games').update({
          matches: newMatches as any,
          players: newPlayers
        }).eq('id', gameId);
        if (error) throw error;
      } catch (error) {
        toast.error("Failed to update game");
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
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 pb-24">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
        <header className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center shadow-lg">
              <Trophy className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">TeamUp! Social Play</h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Smart team assignment & scoring for racket sports
          </p>
        </header>

        <GameCodeDialog open={showGameCodeDialog} onOpenChange={setShowGameCodeDialog} onJoinGame={joinExistingGame} onCreateGame={createNewGame} />

        <Card className="p-6 sm:p-8 md:p-10 shadow-xl min-h-[60vh]">
          {activeSection === "setup" && <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Game Setup</h2>
                <p className="text-muted-foreground">Configure your game settings</p>
              </div>
              <GameSetup onComplete={handleGameConfigComplete} />
            </div>}
          
          {activeSection === "scheduler" && gameConfig && matches.length > 0 && <ScheduleView matches={matches} onBack={resetApp} gameConfig={gameConfig} allPlayers={players} onScheduleUpdate={handleScheduleUpdate} />}

          {activeSection === "scheduler" && (!gameConfig || matches.length === 0) && <div className="text-center py-12">
              <p className="text-muted-foreground">Please complete game setup and add players first</p>
            </div>}

          {activeSection === "checkin" && gameCode && <CheckInOut gameCode={gameCode} players={players} onPlayersUpdate={handlePlayersUpdate} matches={matches} matchScores={matchScores} teammatePairs={gameConfig?.teammatePairs} onNavigateToMatches={() => setActiveSection("scheduler")} />}

          {activeSection === "checkin" && !gameCode && <div className="text-center py-12">
              <p className="text-muted-foreground">Please complete game setup first</p>
            </div>}
        </Card>
      </div>

      <BottomNav activeSection={activeSection} onSectionChange={setActiveSection} disabled={showGameCodeDialog} />
    </div>;
};
export default Index;