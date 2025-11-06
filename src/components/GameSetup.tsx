import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Trophy } from "lucide-react";

interface GameSetupProps {
  playerCount: number;
  onComplete: (config: GameConfig) => void;
  onBack: () => void;
}

export interface GameConfig {
  gameDuration: number;
  totalTime: number;
  courts: number;
}

export const GameSetup = ({ playerCount, onComplete, onBack }: GameSetupProps) => {
  const [gameDuration, setGameDuration] = useState<number>(10);
  const [totalTime, setTotalTime] = useState<number>(60);
  const [courts, setCourts] = useState<number>(2);

  const maxCourts = Math.floor(playerCount / 2);
  const totalTimeOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 15);

  const handleSubmit = () => {
    onComplete({ gameDuration, totalTime, courts });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-accent-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Game Settings</h2>
          <p className="text-muted-foreground text-sm">Configure your session</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Game Duration
          </Label>
          <RadioGroup value={gameDuration.toString()} onValueChange={(v) => setGameDuration(Number(v))}>
            <div className="grid grid-cols-3 gap-3">
              {[5, 10, 15].map((duration) => (
                <label
                  key={duration}
                  className={`relative flex items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    gameDuration === duration
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value={duration.toString()} className="sr-only" />
                  <span className="text-xl font-bold">{duration} min</span>
                </label>
              ))}
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <Label htmlFor="total-time" className="text-base font-semibold">
            Total Play Time
          </Label>
          <Select value={totalTime.toString()} onValueChange={(v) => setTotalTime(Number(v))}>
            <SelectTrigger id="total-time" className="h-12 text-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {totalTimeOptions.map((time) => (
                <SelectItem key={time} value={time.toString()}>
                  {time} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <Label htmlFor="courts" className="text-base font-semibold">
            Number of Courts
          </Label>
          <Select value={courts.toString()} onValueChange={(v) => setCourts(Number(v))}>
            <SelectTrigger id="courts" className="h-12 text-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: Math.min(maxCourts, 10) }, (_, i) => i + 1).map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num} {num === 1 ? "court" : "courts"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Maximum {maxCourts} courts for {playerCount} players
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} size="lg" className="flex-1 h-14 text-base">
          Back
        </Button>
        <Button onClick={handleSubmit} size="lg" className="flex-1 h-14 text-base bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70">
          Generate Schedule
        </Button>
      </div>
    </div>
  );
};
