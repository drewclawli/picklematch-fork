/**
 * ClassicPlayersView - Player management for classic round-robin
 */
import React from "react";
import { CheckInOut } from "@/components/CheckInOut";
import type { Match, GameConfig } from "@/core/types";

interface ClassicPlayersViewProps {
  gameCode: string;
  players: string[];
  gameConfig: GameConfig | null;
  matches: Match[];
  matchScores: Map<string, { team1: number; team2: number }>;
  onPlayersChange: (players: string[], pairs?: { player1: string; player2: string }[]) => void;
  onPlayersUpdate: (players: string[], pairs?: { player1: string; player2: string }[]) => void;
  onNavigateToMatches: () => void;
}

export const ClassicPlayersView: React.FC<ClassicPlayersViewProps> = ({
  gameCode,
  players,
  gameConfig,
  matches,
  matchScores,
  onPlayersChange,
  onPlayersUpdate,
  onNavigateToMatches,
}) => {
  return (
    <div className="flex-1 min-h-0 h-full">
      <CheckInOut
        gameCode={gameCode}
        players={players}
        onPlayersChange={onPlayersChange}
        onPlayersUpdate={onPlayersUpdate}
        matches={matches as any}
        matchScores={matchScores}
        teammatePairs={gameConfig?.teammatePairs}
        onNavigateToMatches={onNavigateToMatches}
        hasStartedMatches={matches.length > 0}
      />
    </div>
  );
};

export default ClassicPlayersView;
