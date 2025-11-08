import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerSetup } from "@/components/PlayerSetup";
import { QRCodeSVG } from "qrcode.react";
import { Share2, Copy, Check, Medal, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Match } from "@/lib/scheduler";
import { Badge } from "@/components/ui/badge";

interface CheckInOutProps {
  gameCode: string;
  players: string[];
  onPlayersUpdate: (players: string[], teammatePairs?: { player1: string; player2: string }[]) => void;
  matches?: Match[];
  matchScores?: Map<string, { team1: number; team2: number }>;
  teammatePairs?: { player1: string; player2: string }[];
  onNavigateToMatches?: () => void;
}

export const CheckInOut = ({ gameCode, players, onPlayersUpdate, matches = [], matchScores = new Map(), teammatePairs = [], onNavigateToMatches }: CheckInOutProps) => {
  const [copied, setCopied] = useState(false);
  const gameUrl = `${window.location.origin}?join=${gameCode}`;

  const leaderboard = useMemo(() => {
    if (!matches.length || !matchScores.size) return [];
    
    const playerStats = new Map<string, { wins: number; losses: number; points: number }>();
    
    matches.forEach((match) => {
      const scores = matchScores.get(match.id);
      if (!scores) return;
      
      const allMatchPlayers = [...match.team1, ...match.team2];
      allMatchPlayers.forEach((player) => {
        if (!playerStats.has(player)) {
          playerStats.set(player, { wins: 0, losses: 0, points: 0 });
        }
      });
      
      const [p1, p2] = match.team1;
      const [p3, p4] = match.team2;
      
      if (scores.team1 > scores.team2) {
        playerStats.get(p1)!.wins++;
        if (p2) playerStats.get(p2)!.wins++;
        playerStats.get(p3)!.losses++;
        if (p4) playerStats.get(p4)!.losses++;
      } else if (scores.team2 > scores.team1) {
        playerStats.get(p3)!.wins++;
        if (p4) playerStats.get(p4)!.wins++;
        playerStats.get(p1)!.losses++;
        if (p2) playerStats.get(p2)!.losses++;
      }
      
      playerStats.get(p1)!.points += scores.team1;
      if (p2) playerStats.get(p2)!.points += scores.team1;
      playerStats.get(p3)!.points += scores.team2;
      if (p4) playerStats.get(p4)!.points += scores.team2;
    });
    
    return Array.from(playerStats.entries())
      .map(([player, stats]) => ({ player, ...stats }))
      .sort((a, b) => b.wins - a.wins || b.points - a.points);
  }, [matches, matchScores]);

  const handleShare = async () => {
    const shareText = leaderboard.length > 0
      ? `🏆 Match Results 🏆\n\n` +
        `Leaderboard:\n` +
        leaderboard.map((entry, idx) => 
          `${idx + 1}. ${entry.player} - ${entry.wins}W/${entry.losses}L (${entry.points} pts)`
        ).join('\n') +
        `\n\n` +
        `Total Matches: ${matches.length}\n\n` +
        `Join my game with code: ${gameCode}\n${gameUrl}`
      : `Join my game with code: ${gameCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Racket Match",
          text: shareText,
          url: gameUrl,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          handleCopy();
        }
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Results copied to clipboard!");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(gameUrl);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Player Check In/Out</h2>
        <p className="text-muted-foreground">Add or remove players from the game</p>
      </div>

      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Game Code</p>
            <p className="text-3xl font-bold font-mono tracking-wider text-primary">{gameCode}</p>
            <p className="text-xs text-muted-foreground mt-1">Share this code with other players</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-inner">
            <QRCodeSVG
              value={gameUrl}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleShare}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share Game
            </Button>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      <PlayerSetup
        onComplete={(playerList, pairs) => {
          onPlayersUpdate(playerList, pairs);
          if (onNavigateToMatches) {
            onNavigateToMatches();
          }
        }}
        initialPlayers={players}
        initialTeammatePairs={teammatePairs}
      />

      {leaderboard.length > 0 && (
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Medal className="w-6 h-6 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Leaderboard</h2>
            </div>
            <Button onClick={handleShare} className="gap-2">
              <Share2 className="w-4 h-4" />
              Share Results
            </Button>
          </div>
          
          <div className="space-y-3">
            {leaderboard.map((entry, idx) => (
              <div
                key={entry.player}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  idx === 0
                    ? "bg-gradient-to-r from-primary/20 to-accent/20 border-2 border-primary"
                    : "bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    idx === 0 ? "bg-primary text-primary-foreground text-lg" :
                    idx === 1 ? "bg-accent text-accent-foreground" :
                    idx === 2 ? "bg-muted text-muted-foreground" :
                    "bg-secondary text-secondary-foreground"
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{entry.player}</div>
                    <div className="text-sm text-muted-foreground">
                      {entry.wins}W / {entry.losses}L • {entry.points} pts
                    </div>
                  </div>
                </div>
                {idx === 0 && <Trophy className="w-8 h-8 text-primary" />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
