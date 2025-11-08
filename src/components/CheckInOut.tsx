import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayerSetup } from "@/components/PlayerSetup";
import { QRCodeSVG } from "qrcode.react";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface CheckInOutProps {
  gameCode: string;
  players: string[];
  onPlayersUpdate: (players: string[]) => void;
}

export const CheckInOut = ({ gameCode, players, onPlayersUpdate }: CheckInOutProps) => {
  const [copied, setCopied] = useState(false);
  const gameUrl = `${window.location.origin}?join=${gameCode}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Racket Match",
          text: `Join my game with code: ${gameCode}`,
          url: gameUrl,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          handleCopy();
        }
      }
    } else {
      handleCopy();
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
        onComplete={(playerList) => onPlayersUpdate(playerList)}
        initialPlayers={players}
      />
    </div>
  );
};
