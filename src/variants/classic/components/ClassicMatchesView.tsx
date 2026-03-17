/**
 * ClassicMatchesView - Match scheduling and scoring with player-first UX
 */
import React from "react";
import { ScheduleView } from "@/components/ScheduleView";
import { Button } from "@/components/ui/button";
import { UserCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match, GameConfig, CourtConfig } from "@/core/types";

interface ClassicMatchesViewProps {
  matches: Match[];
  gameConfig: GameConfig;
  players: string[];
  matchScores: Map<string, { team1: number; team2: number }>;
  onMatchScoresUpdate: (scores: Map<string, { team1: number; team2: number }>) => void;
  onScheduleUpdate: (matches: Match[], players: string[]) => void;
  onCourtConfigUpdate: (configs: CourtConfig[]) => void;
  isPlayerView: boolean;
  playerName: string | null;
  onShowPlayerSelector: () => void;
}

export const ClassicMatchesView: React.FC<ClassicMatchesViewProps> = ({
  matches,
  gameConfig,
  players,
  matchScores,
  onMatchScoresUpdate,
  onScheduleUpdate,
  onCourtConfigUpdate,
  isPlayerView,
  playerName,
  onShowPlayerSelector,
}) => {
  const hasPlayers = players.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {!isPlayerView && hasPlayers && (
        <div className={cn(
          "flex items-center justify-between gap-3 mb-3 p-3 rounded-lg",
          "bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20"
        )}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <UserCircle className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Playing in this game?</p>
              <p className="text-xs text-muted-foreground hidden sm:block">
                See only your matches and get notifications
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onShowPlayerSelector} className="shrink-0">
            <UserCircle className="w-4 h-4 mr-1.5" />
            I'm Playing
          </Button>
        </div>
      )}

      {!isPlayerView && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Organizer View - All matches visible</span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        <ScheduleView
          matches={matches as any}
          onBack={() => {}}
          gameConfig={gameConfig as any}
          allPlayers={players}
          onScheduleUpdate={(updatedMatches, updatedPlayers) => onScheduleUpdate(updatedMatches as any, updatedPlayers)}
          matchScores={matchScores}
          onMatchScoresUpdate={onMatchScoresUpdate}
          onCourtConfigUpdate={(configs) => onCourtConfigUpdate(configs as CourtConfig[])}
          isPlayerView={isPlayerView}
          playerName={playerName}
          onReleaseIdentity={() => {}}
          onShowPlayerSelector={onShowPlayerSelector}
        />
      </div>
    </div>
  );
};

export default ClassicMatchesView;
