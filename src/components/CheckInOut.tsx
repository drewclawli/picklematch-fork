import { PlayerSetup } from "@/components/PlayerSetup";
import { Match } from "@/lib/scheduler";
import { Users } from "lucide-react";
interface CheckInOutProps {
  gameCode: string;
  players: string[];
  onPlayersChange: (players: string[], teammatePairs?: {
    player1: string;
    player2: string;
  }[]) => void;
  onPlayersUpdate: (players: string[], teammatePairs?: {
    player1: string;
    player2: string;
  }[]) => void;
  matches?: Match[];
  matchScores?: Map<string, {
    team1: number;
    team2: number;
  }>;
  teammatePairs?: {
    player1: string;
    player2: string;
  }[];
  onNavigateToMatches?: () => void;
  hasStartedMatches?: boolean;
}
export const CheckInOut = ({
  gameCode,
  players,
  onPlayersChange,
  onPlayersUpdate,
  matches = [],
  matchScores = new Map(),
  teammatePairs = [],
  onNavigateToMatches,
  hasStartedMatches = false
}: CheckInOutProps) => {
  return <div className="flex flex-col min-h-0 flex-1 h-full">
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Players Check in</h2>
            <p className="text-[10px] text-muted-foreground">Dynamic roster management</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Manage your tournament roster dynamically. Players can check in or out anytime, and our intelligent 
          scheduling system automatically regenerates fair team assignments and match rotations to ensure 
          everyone gets balanced playing time.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <PlayerSetup 
          onPlayersChange={onPlayersChange}
          onComplete={(playerList, pairs) => {
            onPlayersUpdate(playerList, pairs);
            if (onNavigateToMatches) {
              onNavigateToMatches();
            }
          }} 
          initialPlayers={players} 
          initialTeammatePairs={teammatePairs} 
          matches={matches} 
          matchScores={matchScores} 
          hasStartedMatches={hasStartedMatches} 
        />
      </div>
    </div>;
};