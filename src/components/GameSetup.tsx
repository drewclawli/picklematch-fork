import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Trophy, Share2, Copy, Check, AlertCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CourtConfig } from "@/lib/scheduler";
interface GameSetupProps {
  playerCount?: number;
  onComplete: (config: GameConfig) => void;
  onBack?: () => void;
  gameCode?: string;
  onNewSession?: () => void;
  hasExistingMatches?: boolean;
}
export interface GameConfig {
  gameDuration: number;
  totalTime: number;
  courts: number;
  teammatePairs?: {
    player1: string;
    player2: string;
  }[];
  courtConfigs?: CourtConfig[];
  schedulingType?: 'round-robin' | 'single-elimination' | 'double-elimination' | 'qualifier-tournament';
  tournamentPlayStyle?: 'singles' | 'doubles';
}
export const GameSetup = ({
  playerCount = 4,
  onComplete,
  onBack,
  gameCode,
  onNewSession,
  hasExistingMatches = false
}: GameSetupProps) => {
  const [gameDuration, setGameDuration] = useState<number>(10);
  const [totalTime, setTotalTime] = useState<number>(60);
  const [courts, setCourts] = useState<number>(2);
  const [schedulingType, setSchedulingType] = useState<'round-robin' | 'single-elimination' | 'double-elimination' | 'qualifier-tournament'>('round-robin');
  const [tournamentPlayStyle, setTournamentPlayStyle] = useState<'singles' | 'doubles'>('doubles');
  const [courtConfigs, setCourtConfigs] = useState<CourtConfig[]>(Array.from({
    length: 2
  }, (_, i) => ({
    courtNumber: i + 1,
    type: 'doubles' as const
  })));
  const [copied, setCopied] = useState(false);
  const gameUrl = gameCode ? `${window.location.origin}?join=${gameCode}` : '';
  const maxCourts = Math.floor(playerCount / 2);
  const totalTimeOptions = Array.from({
    length: 12
  }, (_, i) => (i + 1) * 15);
  const handleCourtsChange = (newCourts: number) => {
    setCourts(newCourts);
    const defaultType: 'singles' | 'doubles' = schedulingType !== 'round-robin' ? tournamentPlayStyle : 'doubles';
    const newConfigs = Array.from({
      length: newCourts
    }, (_, i) => courtConfigs[i] || {
      courtNumber: i + 1,
      type: defaultType
    });
    setCourtConfigs(newConfigs);
  };
  const toggleCourtType = (courtNumber: number) => {
    const newConfigs = courtConfigs.map(config => config.courtNumber === courtNumber ? {
      ...config,
      type: config.type === 'singles' ? 'doubles' as const : 'singles' as const
    } : config);
    setCourtConfigs(newConfigs);
  };
  const handleContinue = () => {
    // Do not block on team/player count here; validate on Players page when updating matches
    const finalCourtConfigs = schedulingType !== 'round-robin' 
      ? courtConfigs.map(config => ({ ...config, type: tournamentPlayStyle as 'singles' | 'doubles' }))
      : courtConfigs;
    
    onComplete({
      gameDuration,
      totalTime,
      courts,
      courtConfigs: finalCourtConfigs,
      schedulingType,
      tournamentPlayStyle: schedulingType !== 'round-robin' ? tournamentPlayStyle : undefined
    });
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
          url: gameUrl
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
  return <div className="space-y-4 pb-2">
      {/* Header Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Game Configuration</h2>
            <p className="text-[10px] text-muted-foreground">Tournament settings</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Configure your tournament settings including match duration, total play time, and number of courts. 
          Choose between singles and doubles play for each court to optimize your pickleball tournament 
          scheduling and maximize court rotation efficiency.
        </p>
      </div>

      {/* Game Code and QR Code Section */}
      {gameCode && <Card className="p-3 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-0.5">Game Code</p>
              <p className="text-xl font-bold font-mono text-primary">{gameCode}</p>
            </div>
            <div className="bg-white p-2 rounded shadow-inner">
              <QRCodeSVG value={gameUrl} size={80} level="H" includeMargin={false} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Button onClick={handleShare} variant="outline" size="sm" className="h-7 text-xs px-2">
                <Share2 className="w-3 h-3 mr-1" />
                Share
              </Button>
              <Button onClick={handleCopy} variant="outline" size="sm" className="h-7 text-xs px-2">
                {copied ? <>
                    <Check className="w-3 h-3 mr-1" />
                    Copied
                  </> : <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </>}
              </Button>
            </div>
          </div>
        </Card>}

      {/* New Session Button - appears when there's an active game */}
      {gameCode && onNewSession && (
        <Button 
          onClick={onNewSession} 
          variant="outline" 
          size="sm" 
          className="w-full gap-1 h-8 text-xs"
        >
          New Session
        </Button>
      )}

      {/* Scheduling Type Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" />
          Scheduling Type
        </Label>
        
        {hasExistingMatches && (
          <Alert className="mb-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Scheduling mode is locked. To change modes, please start a new session.
            </AlertDescription>
          </Alert>
        )}
        
        <RadioGroup 
          value={schedulingType} 
          onValueChange={(v) => setSchedulingType(v as any)}
          disabled={hasExistingMatches}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className={`relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
              hasExistingMatches ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            } ${schedulingType === 'round-robin' ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"}`}>
              <RadioGroupItem value="round-robin" className="sr-only" disabled={hasExistingMatches} />
              <span className="text-sm font-bold">Round Robin</span>
              <p className="text-xs text-muted-foreground text-center mt-1">Everyone plays multiple games</p>
            </label>
            <label className={`relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
              hasExistingMatches ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            } ${schedulingType === 'qualifier-tournament' ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"}`}>
              <RadioGroupItem value="qualifier-tournament" className="sr-only" disabled={hasExistingMatches} />
              <span className="text-sm font-bold">Qualifier Stage</span>
              <p className="text-xs text-muted-foreground text-center mt-1">Groups then knockout (4-24 teams)</p>
            </label>
            <label className={`relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
              hasExistingMatches ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            } ${schedulingType === 'single-elimination' ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"}`}>
              <RadioGroupItem value="single-elimination" className="sr-only" disabled={hasExistingMatches} />
              <span className="text-sm font-bold">Single Elim</span>
              <p className="text-xs text-muted-foreground text-center mt-1">4/8/16 teams only</p>
            </label>
            <label className={`relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
              hasExistingMatches ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            } ${schedulingType === 'double-elimination' ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"}`}>
              <RadioGroupItem value="double-elimination" className="sr-only" disabled={hasExistingMatches} />
              <span className="text-sm font-bold">Double Elim</span>
              <p className="text-xs text-muted-foreground text-center mt-1">4/8/16 teams only</p>
            </label>
          </div>
        </RadioGroup>
        
        {/* Scheduling Mode Explanation */}
        <Alert className="mt-3 border-primary/20 bg-primary/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs leading-relaxed">
            {schedulingType === 'round-robin' && (
              <span><strong>Round Robin:</strong> Every player plays with and against different teammates throughout the session. Ideal for social play where everyone gets to know each other.</span>
            )}
            {schedulingType === 'single-elimination' && (
              <span><strong>Single Elimination:</strong> One loss and you're out. Fast-paced tournament format requiring exactly 4, 8, or 16 teams. Winners advance until one champion remains.</span>
            )}
            {schedulingType === 'double-elimination' && (
              <span><strong>Double Elimination:</strong> Teams get a second chance via the losers bracket. Requires 4, 8, or 16 teams. More forgiving than single elimination while maintaining competitive intensity.</span>
            )}
            {schedulingType === 'qualifier-tournament' && (
              <span><strong>Qualifier Tournament:</strong> Groups stage followed by knockout rounds. Supports 4-24 teams. Teams compete in small groups, then top performers advance to single-elimination finals.</span>
            )}
          </AlertDescription>
        </Alert>
      </div>

      {/* Tournament Play Style - Only show for tournament modes */}
      {schedulingType !== 'round-robin' && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Tournament Play Style</Label>
          <p className="text-xs text-muted-foreground">All courts will be configured for this play style</p>
          <RadioGroup value={tournamentPlayStyle} onValueChange={(v) => {
            const newStyle = v as 'singles' | 'doubles';
            setTournamentPlayStyle(newStyle);
            // Update all court configs to match the tournament play style
            setCourtConfigs(courtConfigs.map(config => ({ ...config, type: newStyle })));
          }}>
            <div className="grid grid-cols-2 gap-2">
              <label className={`relative flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${tournamentPlayStyle === 'singles' ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"}`}>
                <RadioGroupItem value="singles" className="sr-only" />
                <span className="text-sm font-bold">Singles</span>
                <p className="text-xs text-muted-foreground text-center mt-1">Individual players</p>
              </label>
              <label className={`relative flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${tournamentPlayStyle === 'doubles' ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"}`}>
                <RadioGroupItem value="doubles" className="sr-only" />
                <span className="text-sm font-bold">Doubles</span>
                <p className="text-xs text-muted-foreground text-center mt-1">Paired teams</p>
              </label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Form Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Game Duration */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Game Duration
          </Label>
          <RadioGroup value={gameDuration.toString()} onValueChange={v => setGameDuration(Number(v))}>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 15].map(duration => <label key={duration} className={`relative flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${gameDuration === duration ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"}`}>
                  <RadioGroupItem value={duration.toString()} className="sr-only" />
                  <span className="text-sm font-bold">{duration} min</span>
                </label>)}
            </div>
          </RadioGroup>
        </div>

        {/* Total Play Time - Only show for round-robin */}
        {schedulingType === 'round-robin' && (
          <div className="space-y-2">
            <Label htmlFor="total-time" className="text-sm font-semibold">
              Total Play Time
            </Label>
            <Select value={totalTime.toString()} onValueChange={v => setTotalTime(Number(v))}>
              <SelectTrigger id="total-time" className="h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {totalTimeOptions.map(time => <SelectItem key={time} value={time.toString()} className="text-sm">
                    {time} minutes
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Number of Courts */}
        <div className="space-y-2">
          <Label htmlFor="courts" className="text-sm font-semibold">
            Number of Courts
          </Label>
          <Select value={courts.toString()} onValueChange={v => handleCourtsChange(Number(v))}>
            <SelectTrigger id="courts" className="h-10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({
              length: Math.min(maxCourts, 10)
            }, (_, i) => i + 1).map(num => <SelectItem key={num} value={num.toString()} className="text-sm">
                  {num} {num === 1 ? "court" : "courts"}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Court Configuration - Only show for round-robin */}
        {schedulingType === 'round-robin' && (
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-sm font-semibold">
              Court Configuration
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {courtConfigs.map(config => <div key={config.courtNumber} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <Label htmlFor={`court-${config.courtNumber}`} className="text-sm font-medium">
                    Court {config.courtNumber}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${config.type === 'singles' ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                      Doubles
                    </span>
                    <Switch id={`court-${config.courtNumber}`} checked={config.type === 'singles'} onCheckedChange={() => toggleCourtType(config.courtNumber)} className="scale-90" />
                    <span className={`text-xs ${config.type === 'singles' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      Singles
                    </span>
                  </div>
                </div>)}
            </div>
          </div>
        )}
      </div>

      {/* Continue Button */}
      <Button onClick={handleContinue} size="lg" className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-accent text-white shadow-sport">
        Continue to Players
      </Button>
    </div>;
};