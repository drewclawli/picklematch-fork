import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Clock, Trophy, Share2, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CourtConfig } from "@/lib/scheduler";

interface GameSetupProps {
  playerCount?: number;
  onComplete: (config: GameConfig) => void;
  onBack?: () => void;
  gameCode?: string;
}

export interface GameConfig {
  gameDuration: number;
  totalTime: number;
  courts: number;
  teammatePairs?: { player1: string; player2: string }[];
  courtConfigs?: CourtConfig[];
}

export const GameSetup = ({ playerCount = 4, onComplete, onBack, gameCode }: GameSetupProps) => {
  const [gameDuration, setGameDuration] = useState<number>(10);
  const [totalTime, setTotalTime] = useState<number>(60);
  const [courts, setCourts] = useState<number>(2);
  const [courtConfigs, setCourtConfigs] = useState<CourtConfig[]>(
    Array.from({ length: 2 }, (_, i) => ({ courtNumber: i + 1, type: 'doubles' as const }))
  );
  const [copied, setCopied] = useState(false);

  const gameUrl = gameCode ? `${window.location.origin}?join=${gameCode}` : '';

  const maxCourts = Math.floor(playerCount / 2);
  const totalTimeOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 15);

  const handleCourtsChange = (newCourts: number) => {
    setCourts(newCourts);
    const newConfigs = Array.from({ length: newCourts }, (_, i) => 
      courtConfigs[i] || { courtNumber: i + 1, type: 'doubles' as const }
    );
    setCourtConfigs(newConfigs);
    onComplete({ gameDuration, totalTime, courts: newCourts, courtConfigs: newConfigs });
  };

  const toggleCourtType = (courtNumber: number) => {
    const newConfigs = courtConfigs.map(config => 
      config.courtNumber === courtNumber 
        ? { ...config, type: config.type === 'singles' ? 'doubles' as const : 'singles' as const }
        : config
    );
    setCourtConfigs(newConfigs);
    onComplete({ gameDuration, totalTime, courts, courtConfigs: newConfigs });
  };

  // Update parent state whenever settings change
  const updateConfig = () => {
    onComplete({ gameDuration, totalTime, courts, courtConfigs });
  };

  const handleCopy = () => {
    if (!gameUrl) return;
    navigator.clipboard.writeText(gameUrl);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!gameCode || !gameUrl) return;
    const shareText = `Join my game with code: ${gameCode}`;
    
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
      toast.success("Link copied to clipboard!");
    }
  };

  return (
    <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pb-2">

      {/* Game Code and QR Code Section - Compact */}
      {gameCode && (
        <Card className="p-2 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <p className="text-[9px] text-muted-foreground">Code</p>
              <p className="text-base font-bold font-mono text-primary">{gameCode}</p>
            </div>
            <div className="bg-white p-1.5 rounded shadow-inner">
              <QRCodeSVG
                value={gameUrl}
                size={60}
                level="H"
                includeMargin={false}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Button
                onClick={handleShare}
                variant="outline"
                size="sm"
                className="h-6 text-[9px] px-1.5"
              >
                <Share2 className="w-2.5 h-2.5" />
              </Button>
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="h-6 text-[9px] px-1.5"
              >
                {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Compact Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Game Duration */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            Duration
          </Label>
          <RadioGroup value={gameDuration.toString()} onValueChange={(v) => {
            const newDuration = Number(v);
            setGameDuration(newDuration);
            onComplete({ gameDuration: newDuration, totalTime, courts, courtConfigs });
          }}>
            <div className="grid grid-cols-3 gap-1">
              {[5, 10, 15].map((duration) => (
                <label
                  key={duration}
                  className={`relative flex items-center justify-center p-1.5 rounded border-2 cursor-pointer transition-all ${
                    gameDuration === duration
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <RadioGroupItem value={duration.toString()} className="sr-only" />
                  <span className="text-xs font-bold">{duration}m</span>
                </label>
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Total Play Time */}
        <div className="space-y-1">
          <Label htmlFor="total-time" className="text-xs font-semibold">
            Total Time
          </Label>
          <Select value={totalTime.toString()} onValueChange={(v) => {
            const newTime = Number(v);
            setTotalTime(newTime);
            onComplete({ gameDuration, totalTime: newTime, courts, courtConfigs });
          }}>
            <SelectTrigger id="total-time" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {totalTimeOptions.map((time) => (
                <SelectItem key={time} value={time.toString()} className="text-xs">
                  {time} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Number of Courts */}
        <div className="space-y-1">
          <Label htmlFor="courts" className="text-xs font-semibold">
            Courts
          </Label>
          <Select value={courts.toString()} onValueChange={(v) => handleCourtsChange(Number(v))}>
            <SelectTrigger id="courts" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: Math.min(maxCourts, 10) }, (_, i) => i + 1).map((num) => (
                <SelectItem key={num} value={num.toString()} className="text-xs">
                  {num} {num === 1 ? "court" : "courts"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Court Configuration */}
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs font-semibold">
            Court Type
          </Label>
          <div className="grid grid-cols-2 gap-1">
            {courtConfigs.map((config) => (
              <div key={config.courtNumber} className="flex items-center justify-between p-1.5 rounded border bg-card">
                <Label htmlFor={`court-${config.courtNumber}`} className="text-[10px] font-medium">
                  Court {config.courtNumber}
                </Label>
                <div className="flex items-center gap-1">
                  <span className={`text-[9px] ${config.type === 'singles' ? 'text-muted-foreground' : 'text-foreground'}`}>
                    2v2
                  </span>
                  <Switch
                    id={`court-${config.courtNumber}`}
                    checked={config.type === 'singles'}
                    onCheckedChange={() => toggleCourtType(config.courtNumber)}
                    className="scale-[0.65]"
                  />
                  <span className={`text-[9px] ${config.type === 'singles' ? 'text-foreground' : 'text-muted-foreground'}`}>
                    1v1
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
