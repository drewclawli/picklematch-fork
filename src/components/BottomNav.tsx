import { Settings, Calendar, Users, Trophy, History } from "lucide-react";
import { cn } from "@/lib/utils";
interface BottomNavProps {
  activeSection: "setup" | "players" | "matches" | "history" | "leaderboard";
  onSectionChange: (section: "setup" | "players" | "matches" | "history" | "leaderboard") => void;
  disabled?: boolean;
}
export const BottomNav = ({
  activeSection,
  onSectionChange,
  disabled
}: BottomNavProps) => {
  return <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t-2 border-primary/20 shadow-sport">
      <div className="max-w-5xl mx-auto px-2">
        <div className="flex items-center justify-around py-3">
          <button onClick={() => onSectionChange("setup")} disabled={disabled} className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all hover:scale-105", activeSection === "setup" ? "text-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-md" : "text-muted-foreground hover:text-primary hover:bg-primary/5", disabled && "opacity-50 cursor-not-allowed")}>
            <Settings className="w-5 h-5" />
            <span className="text-xs font-semibold">Setup</span>
          </button>

          <button onClick={() => onSectionChange("players")} disabled={disabled} className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all hover:scale-105", activeSection === "players" ? "text-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-md" : "text-muted-foreground hover:text-primary hover:bg-primary/5", disabled && "opacity-50 cursor-not-allowed")}>
            <Users className="w-5 h-5" />
            <span className="text-xs font-semibold">Players</span>
          </button>

          <button onClick={() => onSectionChange("matches")} disabled={disabled} className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all relative -mt-8", activeSection === "matches" ? "text-primary" : "text-muted-foreground hover:text-primary")}>
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center transition-all", activeSection === "matches" ? "bg-gradient-to-br from-primary via-primary to-accent shadow-sport scale-110 animate-pulse" : "bg-gradient-to-br from-muted to-muted/60 hover:from-primary/20 hover:to-accent/20 hover:scale-105 shadow-md")}>
              <Calendar className={cn("w-8 h-8", activeSection === "matches" ? "text-white drop-shadow-lg" : "text-foreground")} />
            </div>
            <span className={cn("text-xs font-semibold mt-1", activeSection === "matches" ? "text-primary" : "")}>Matches</span>
          </button>

          <button onClick={() => onSectionChange("history")} disabled={disabled} className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all hover:scale-105", activeSection === "history" ? "text-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-md" : "text-muted-foreground hover:text-primary hover:bg-primary/5", disabled && "opacity-50 cursor-not-allowed")}>
            <History className="w-5 h-5" />
            <span className="text-xs font-semibold">History</span>
          </button>

          <button onClick={() => onSectionChange("leaderboard")} disabled={disabled} className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all hover:scale-105", activeSection === "leaderboard" ? "text-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-md" : "text-muted-foreground hover:text-primary hover:bg-primary/5", disabled && "opacity-50 cursor-not-allowed")}>
            <Trophy className="w-5 h-5" />
            <span className="text-xs font-semibold">Leaderboard</span>
          </button>
        </div>
      </div>
    </nav>;
};