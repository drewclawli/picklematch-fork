import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { validateGameCode } from "@/lib/validation";

interface GameCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinGame: (gameCode: string) => void;
  onCreateGame: () => void;
}

export const GameCodeDialog = ({ open, onOpenChange, onJoinGame, onCreateGame }: GameCodeDialogProps) => {
  const [gameCode, setGameCode] = useState("");

  const handleJoin = () => {
    const code = gameCode.trim().toUpperCase();
    
    const validation = validateGameCode(code);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid game code");
      return;
    }
    
    onJoinGame(code);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join or Create Game</DialogTitle>
          <DialogDescription>
            Enter a game code to join an existing game, or create a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="game-code">Game Code</Label>
            <div className="flex gap-2">
              <Input
                id="game-code"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-character code"
                maxLength={6}
                className="flex-1 uppercase font-mono text-lg tracking-wider"
              />
              <Button onClick={handleJoin} disabled={gameCode.length !== 6}>
                Join
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button onClick={onCreateGame} className="w-full" variant="default">
            Create New Game
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
