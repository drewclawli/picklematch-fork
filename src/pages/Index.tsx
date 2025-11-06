import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PlayerSetup } from "@/components/PlayerSetup";
import { GameSetup, GameConfig } from "@/components/GameSetup";
import { ScheduleView } from "@/components/ScheduleView";
import { generateSchedule, Match } from "@/lib/scheduler";
import { Trophy } from "lucide-react";

type Step = "players" | "setup" | "schedule";

const Index = () => {
  const [step, setStep] = useState<Step>("players");
  const [players, setPlayers] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  const handlePlayersComplete = (playerList: string[]) => {
    setPlayers(playerList);
    setStep("setup");
  };

  const handleGameSetupComplete = (config: GameConfig) => {
    setGameConfig(config);
    const schedule = generateSchedule(
      players,
      config.gameDuration,
      config.totalTime,
      config.courts,
      config.startTime
    );
    setMatches(schedule);
    setStep("schedule");
  };

  const handleScheduleUpdate = (newMatches: Match[], newPlayers: string[]) => {
    setMatches(newMatches);
    setPlayers(newPlayers);
  };

  const handleBack = () => {
    if (step === "setup") {
      setStep("players");
    } else if (step === "schedule") {
      setStep("setup");
    }
  };

  const resetApp = () => {
    setStep("players");
    setPlayers([]);
    setMatches([]);
    setGameConfig(null);
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

        <Card className="p-6 sm:p-8 md:p-10 shadow-xl">
          {step === "players" && <PlayerSetup onComplete={handlePlayersComplete} />}
          
          {step === "setup" && (
            <GameSetup
              playerCount={players.length}
              onComplete={handleGameSetupComplete}
              onBack={handleBack}
            />
          )}
          
          {step === "schedule" && gameConfig && (
            <ScheduleView
              matches={matches}
              onBack={resetApp}
              gameConfig={gameConfig}
              allPlayers={players}
              onScheduleUpdate={handleScheduleUpdate}
            />
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
