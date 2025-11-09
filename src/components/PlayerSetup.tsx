import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { X, Plus, Users, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Match } from "@/lib/scheduler";
import { validatePlayerName } from "@/lib/validation";
interface PlayerSetupProps {
  onComplete: (players: string[], teammatePairs?: {
    player1: string;
    player2: string;
  }[]) => void;
  initialPlayers?: string[];
  initialTeammatePairs?: {
    player1: string;
    player2: string;
  }[];
  matches?: Match[];
  matchScores?: Map<string, {
    team1: number;
    team2: number;
  }>;
  hasStartedMatches?: boolean;
}
export const PlayerSetup = ({
  onComplete,
  initialPlayers = [],
  initialTeammatePairs = [],
  matches = [],
  matchScores = new Map(),
  hasStartedMatches = false
}: PlayerSetupProps) => {
  const [players, setPlayers] = useState<string[]>(initialPlayers);
  const [currentName, setCurrentName] = useState("");
  const [teammatePairs, setTeammatePairs] = useState<{
    player1: string;
    player2: string;
  }[]>(initialTeammatePairs);
  const [selectedForPairing, setSelectedForPairing] = useState<string | null>(null);
  const addPlayer = () => {
    const trimmedName = currentName.trim();
    if (!trimmedName) {
      return;
    }

    // Validate player name format
    const validation = validatePlayerName(trimmedName);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid player name");
      return;
    }

    // Check for duplicate names (case-insensitive)
    if (players.some(p => p.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error("This player name already exists");
      return;
    }
    setPlayers([...players, trimmedName]);
    setCurrentName("");
  };
  const removePlayer = (index: number) => {
    const playerToRemove = players[index];
    setPlayers(players.filter((_, i) => i !== index));
    // Remove any pairs involving this player
    setTeammatePairs(teammatePairs.filter(pair => pair.player1 !== playerToRemove && pair.player2 !== playerToRemove));
    if (selectedForPairing === playerToRemove) {
      setSelectedForPairing(null);
    }
  };
  const togglePairSelection = (player: string) => {
    if (selectedForPairing === player) {
      setSelectedForPairing(null);
    } else if (selectedForPairing === null) {
      setSelectedForPairing(player);
    } else {
      const existingPair = teammatePairs.find(pair => pair.player1 === selectedForPairing && pair.player2 === player || pair.player1 === player && pair.player2 === selectedForPairing);
      if (existingPair) {
        toast.error("These players are already paired");
      } else {
        setTeammatePairs([...teammatePairs, {
          player1: selectedForPairing,
          player2: player
        }]);
        toast.success(`${selectedForPairing} & ${player} are now teammates`);
      }
      setSelectedForPairing(null);
    }
  };
  const removePair = (pair: {
    player1: string;
    player2: string;
  }) => {
    setTeammatePairs(teammatePairs.filter(p => p !== pair));
    toast.success("Pair removed");
  };
  const isPaired = (player: string) => {
    return teammatePairs.some(pair => pair.player1 === player || pair.player2 === player);
  };
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addPlayer();
    }
  };
  return <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        
        <div>
          
          
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input placeholder="Enter player name" value={currentName} onChange={e => setCurrentName(e.target.value)} onKeyPress={handleKeyPress} className="h-12 text-lg" maxLength={50} />
        </div>
        <Button onClick={addPlayer} disabled={!currentName.trim()} size="lg" className="h-12 px-6">
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      <Button onClick={() => onComplete(players, teammatePairs)} disabled={players.length < 2} size="lg" className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-accent text-white shadow-sport">
        {hasStartedMatches ? "Update Matches" : "Continue to Matches"} ({players.length} players)
      </Button>

      <div className="text-sm text-muted-foreground">
        {players.length} players added
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
        {players.map((player, index) => <Card key={index} className={`p-4 flex items-center justify-between hover:shadow-md transition-all ${selectedForPairing === player ? "border-2 border-primary bg-primary/5" : isPaired(player) ? "border border-accent/50 bg-accent/5" : ""}`}>
            <span className="font-medium text-foreground">{player}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => togglePairSelection(player)} className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" title="Link as teammates">
                <Link2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => removePlayer(index)} className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </Card>)}
      </div>

      {selectedForPairing && <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm text-foreground">
            Select another player to pair with <strong>{selectedForPairing}</strong>
          </p>
        </div>}

      {teammatePairs.length > 0 && <div className="pt-4 border-t space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Teammate Pairs</h4>
          {teammatePairs.map((pair, idx) => <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20">
              <span className="text-sm font-medium">
                {pair.player1} & {pair.player2}
              </span>
              <Button variant="ghost" size="sm" onClick={() => removePair(pair)} className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive">
                <X className="w-4 h-4" />
              </Button>
            </div>)}
        </div>}
    </div>;
};