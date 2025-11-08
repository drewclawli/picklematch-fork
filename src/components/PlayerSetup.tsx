import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { X, Plus, Users } from "lucide-react";

interface PlayerSetupProps {
  onComplete: (players: string[]) => void;
  initialPlayers?: string[];
}

export const PlayerSetup = ({ onComplete, initialPlayers = [] }: PlayerSetupProps) => {
  const [players, setPlayers] = useState<string[]>(initialPlayers);
  const [currentName, setCurrentName] = useState("");

  const addPlayer = () => {
    if (currentName.trim() && players.length < 20) {
      setPlayers([...players, currentName.trim()]);
      setCurrentName("");
    }
  };

  const removePlayer = (index: number) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addPlayer();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
          <Users className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Add Players</h2>
          <p className="text-muted-foreground text-sm">Add up to 20 players</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Enter player name"
            value={currentName}
            onChange={(e) => setCurrentName(e.target.value)}
            onKeyPress={handleKeyPress}
            className="h-12 text-lg"
            maxLength={30}
          />
        </div>
        <Button
          onClick={addPlayer}
          disabled={!currentName.trim() || players.length >= 20}
          size="lg"
          className="h-12 px-6"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        {players.length} / 20 players added
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
        {players.map((player, index) => (
          <Card
            key={index}
            className="p-4 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <span className="font-medium text-foreground">{player}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removePlayer(index)}
              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </Card>
        ))}
      </div>

      <Button
        onClick={() => onComplete(players)}
        disabled={players.length < 2}
        size="lg"
        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
      >
        Continue ({players.length} players)
      </Button>
    </div>
  );
};
