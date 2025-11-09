import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface PlayerIdentitySelectorProps {
  players: string[];
  onSelect: (playerName: string) => void;
  onCancel: () => void;
}

export const PlayerIdentitySelector = ({ players, onSelect, onCancel }: PlayerIdentitySelectorProps) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Select Your Name</h2>
          <p className="text-muted-foreground">
            Tap your name to switch to player view and get match notifications
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
          {players.map((player) => (
            <button
              key={player}
              onClick={() => setSelectedPlayer(player)}
              className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                selectedPlayer === player
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/20">
                  {getInitials(player)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-center break-words w-full">
                {player}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() => selectedPlayer && onSelect(selectedPlayer)}
            disabled={!selectedPlayer}
            className="flex-1"
          >
            <User className="mr-2 h-4 w-4" />
            Continue as Player
          </Button>
        </div>
      </Card>
    </div>
  );
};
