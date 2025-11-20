import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Match } from "@/lib/scheduler";
import { PlayerMatchGroups } from "@/hooks/use-player-matches";
import { Clock, MapPin, Users, ChevronDown, ChevronUp, UserCircle } from "lucide-react";
import { useState } from "react";
import { PlayerStatusCard } from "./PlayerStatusCard";

interface MyMatchesViewProps {
  playerName: string;
  matchGroups: PlayerMatchGroups;
  matchScores: Map<string, { team1: number; team2: number }>;
  currentTime: Date;
  allMatches: Match[];
  onReleaseIdentity?: () => void;
  onSkipMatch?: (matchId: string) => void;
}

export const MyMatchesView = ({
  playerName,
  matchGroups,
  matchScores,
  currentTime,
  allMatches,
  onReleaseIdentity,
  onSkipMatch,
}: MyMatchesViewProps) => {
  const [showLater, setShowLater] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const renderMatch = (match: Match, status: "current" | "upnext" | "later" | "completed", matchIndex: number) => {
    const team1HasPlayer = match.team1.includes(playerName);
    const score = matchScores.get(match.id);
    const isWinner = score && 
      ((team1HasPlayer && score.team1 > score.team2) || 
       (!team1HasPlayer && score.team2 > score.team1));

    // Court/match labeling to match schedule cards (A1, A2, B1...)
    const courtLetter = String.fromCharCode(64 + (match.court || 1));
    const perCourtIndex = allMatches.filter(m => m.court === match.court && m.endTime <= match.endTime).length;
    const matchLabel = `${courtLetter}${perCourtIndex}`;

    // Calculate estimated start time for upcoming matches
    const getEstimatedTime = () => {
      if (status === "current" || status === "completed") return null;
      
      // Estimate 15 minutes per match
      const minutesPerMatch = 15;
      const estimatedMinutes = matchIndex * minutesPerMatch;
      const estimatedTime = new Date(currentTime.getTime() + estimatedMinutes * 60000);
      
      return estimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
      <Card
        key={match.id}
        className={`p-4 transition-all ${
          status === "current"
            ? "border-2 border-green-500 bg-green-500/5 animate-pulse"
            : status === "upnext"
            ? "border-2 border-yellow-500 bg-yellow-500/5"
            : status === "completed" && isWinner
            ? "border-green-500/50 bg-green-500/5"
            : ""
        }`}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono">
                {matchLabel}
              </Badge>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Court {courtLetter}</span>
              </div>
            </div>
            {status === "current" && (
              <Badge className="bg-green-500">Playing Now</Badge>
            )}
            {status === "upnext" && (
              <Badge className="bg-yellow-500">Up Next</Badge>
            )}
            {status === "completed" && score && (
              <Badge variant={isWinner ? "default" : "secondary"}>
                {isWinner ? "Won" : "Lost"}
              </Badge>
            )}
          </div>

          {/* Match Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`space-y-1 ${team1HasPlayer ? "font-bold" : ""}`}>
              <p className="text-sm text-muted-foreground">Team 1</p>
              {match.team1.map((p) => (
                <p key={p} className={`text-sm ${p === playerName ? "text-primary font-bold" : ""}`}>
                  {p === playerName ? "You" : p}
                </p>
              ))}
              {score && (
                <p className="text-2xl font-bold">{score.team1}</p>
              )}
            </div>

            <div className={`space-y-1 ${!team1HasPlayer ? "font-bold" : ""}`}>
              <p className="text-sm text-muted-foreground">Team 2</p>
              {match.team2.map((p) => (
                <p key={p} className={`text-sm ${p === playerName ? "text-primary font-bold" : ""}`}>
                  {p === playerName ? "You" : p}
                </p>
              ))}
              {score && (
                <p className="text-2xl font-bold">{score.team2}</p>
              )}
            </div>
          </div>

          {(status === "current" || status === "upnext") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSkipMatch?.(match.id)}
              className="text-xs"
            >
              Skip Match
            </Button>
          )}
        </div>
      </Card>
    );
  };

  const totalMatches = matchGroups.current
    ? 1 + matchGroups.upNext.length + matchGroups.later.length + matchGroups.completed.length
    : matchGroups.upNext.length + matchGroups.later.length + matchGroups.completed.length;

  return (
    <div className="space-y-4">
      {/* Header with Organizer View Button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">
            Playing as: <span className="text-primary font-bold">{playerName}</span>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onReleaseIdentity}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Organizer View
        </Button>
      </div>

      {/* Status Card */}
      <PlayerStatusCard
        playerName={playerName}
        currentMatch={matchGroups.current}
        upNextCount={matchGroups.upNext.length}
        matchesPlayed={matchGroups.completed.length}
        totalMatches={totalMatches}
      />

      {/* Current Match */}
      {matchGroups.current && (
        <div className="space-y-2">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-green-500" />
            Playing Now
          </h2>
          {renderMatch(matchGroups.current, "current", 0)}
        </div>
      )}

      {/* Up Next */}
      {matchGroups.upNext.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            Up Next
          </h2>
          {matchGroups.upNext.map((match, idx) => renderMatch(match, "upnext", idx + 1))}
        </div>
      )}

      {/* Later Matches */}
      {matchGroups.later.length > 0 && (
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={() => setShowLater(!showLater)}
            className="w-full justify-between p-2"
          >
            <span className="text-base font-bold text-foreground">
              Later ({matchGroups.later.length})
            </span>
            {showLater ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {showLater && (
            <div className="space-y-2">
              {matchGroups.later.map((match, idx) => 
                renderMatch(match, "later", matchGroups.upNext.length + idx + 1)
              )}
            </div>
          )}
        </div>
      )}

      {/* Completed Matches */}
      {matchGroups.completed.length > 0 && (
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full justify-between p-2"
          >
            <span className="text-base font-bold text-foreground">
              Completed ({matchGroups.completed.length})
            </span>
            {showCompleted ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {showCompleted && (
            <div className="space-y-2">
              {matchGroups.completed.map((match, idx) => 
                renderMatch(match, "completed", totalMatches - matchGroups.completed.length + idx)
              )}
            </div>
          )}
        </div>
      )}

      {/* No matches */}
      {!matchGroups.current && matchGroups.upNext.length === 0 && matchGroups.later.length === 0 && (
        <Card className="p-6 sm:p-8 text-center">
          <p className="text-sm text-muted-foreground">No upcoming matches. Check back later!</p>
        </Card>
      )}
    </div>
  );
};
