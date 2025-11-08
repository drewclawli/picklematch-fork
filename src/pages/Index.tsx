import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { CombinedSetup } from "@/components/CombinedSetup";
import { GameCodeDialog } from "@/components/GameCodeDialog";
import { ScheduleView } from "@/components/ScheduleView";
import { generateSchedule, Match, CourtConfig } from "@/lib/scheduler";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GameConfig } from "@/components/GameSetup";
import { QRCodeSVG } from "qrcode.react";

type Step = "start" | "setup" | "schedule";

const Index = () => {
  const [step, setStep] = useState<Step>("start");
  const [players, setPlayers] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameCode, setGameCode] = useState<string>("");
  const [showGameCodeDialog, setShowGameCodeDialog] = useState(true);

  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel('game-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedGame = payload.new;
            setPlayers(updatedGame.players || []);
            setMatches((updatedGame.matches as unknown as Match[]) || []);
            setGameConfig(updatedGame.game_config as unknown as GameConfig);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const createNewGame = async () => {
    setShowGameCodeDialog(false);
    setStep("setup");
  };

  const joinExistingGame = async (code: string) => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('game_code', code)
        .single();

      if (error || !data) {
        toast.error("Game not found. Please check the code and try again.");
        return;
      }

      setGameId(data.id);
      setGameCode(data.game_code);
      setPlayers(data.players || []);
      setGameConfig(data.game_config as unknown as GameConfig);
      setMatches((data.matches as unknown as Match[]) || []);
      setShowGameCodeDialog(false);
      
      if (data.matches && Array.isArray(data.matches) && data.matches.length > 0) {
        setStep("schedule");
      } else {
        setStep("setup");
      }
      
      toast.success(`Joined game: ${code}`);
    } catch (error) {
      toast.error("Failed to join game");
      console.error(error);
    }
  };

  const handleSetupComplete = async (playerList: string[], config: GameConfig) => {
    setGameConfig(config);
    const schedule = generateSchedule(
      playerList,
      config.gameDuration,
      config.totalTime,
      config.courts,
      config.startTime,
      config.teammatePairs,
      config.courtConfigs
    );
    setMatches(schedule);
    setPlayers(playerList);

    try {
      if (gameId) {
        const { error } = await supabase
          .from('games')
          .update({
            players: playerList,
            game_config: config as any,
            matches: schedule as any,
          })
          .eq('id', gameId);

        if (error) throw error;
      } else {
        const { data: codeData } = await supabase.rpc('generate_game_code');
        const newGameCode = codeData as string;

        const { data, error } = await supabase
          .from('games')
          .insert({
            game_code: newGameCode,
            players: playerList,
            game_config: config as any,
            matches: schedule as any,
          })
          .select()
          .single();

        if (error) throw error;
        
        setGameId(data.id);
        setGameCode(newGameCode);
        toast.success(`Game created! Code: ${newGameCode}`);
      }
      
      setStep("schedule");
    } catch (error) {
      toast.error("Failed to save game");
      console.error(error);
    }
  };

  const handleScheduleUpdate = async (newMatches: Match[], newPlayers: string[]) => {
    setMatches(newMatches);
    setPlayers(newPlayers);

    if (gameId) {
      try {
        const { error } = await supabase
          .from('games')
          .update({
            matches: newMatches as any,
            players: newPlayers,
          })
          .eq('id', gameId);

        if (error) throw error;
      } catch (error) {
        toast.error("Failed to update game");
        console.error(error);
      }
    }
  };

  const resetApp = () => {
    setStep("start");
    setPlayers([]);
    setMatches([]);
    setGameConfig(null);
    setGameId(null);
    setGameCode("");
    setShowGameCodeDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center shadow-lg">
              <Trophy className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            Racket Match Manager
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Smart team assignment & scoring for racket sports
          </p>
        </header>

        <GameCodeDialog
          open={showGameCodeDialog}
          onOpenChange={setShowGameCodeDialog}
          onJoinGame={joinExistingGame}
          onCreateGame={createNewGame}
        />

        <Card className="p-6 sm:p-8 md:p-10 shadow-xl">
          {step === "setup" && (
            <CombinedSetup onComplete={handleSetupComplete} />
          )}
          
          {step === "schedule" && gameConfig && (
            <div className="space-y-4">
              {gameCode && (
                <div className="flex flex-col items-center gap-4 p-6 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Game Code</p>
                    <p className="text-3xl font-bold font-mono tracking-wider text-primary">{gameCode}</p>
                    <p className="text-xs text-muted-foreground mt-1">Share this code with other players</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <QRCodeSVG 
                      value={`${window.location.origin}?join=${gameCode}`}
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Scan to join this game</p>
                </div>
              )}
              <ScheduleView
                matches={matches}
                onBack={resetApp}
                gameConfig={gameConfig}
                allPlayers={players}
                onScheduleUpdate={handleScheduleUpdate}
              />
            </div>
          )}
        </Card>

        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>Perfect for tennis, pickleball, badminton, and more!</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
