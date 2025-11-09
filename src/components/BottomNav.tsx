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
  return <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t-2 border-primary/20 shadow-sport z-50">
      <div className="max-w-5xl mx-auto px-2">
        <div className="flex items-center justify-between py-2">
          <button onClick={() => onSectionChange("setup")} disabled={disabled} className={cn("flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all hover:scale-105 flex-1 min-w-0", activeSection === "setup" ? "text-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-md" : "text-muted-foreground hover:text-primary hover:bg-primary/5", disabled && "opacity-50 cursor-not-allowed")}>
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] font-semibold truncate">Setup</span>
          </button>

          <button onClick={() => onSectionChange("players")} disabled={disabled} className={cn("flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all hover:scale-105 flex-1 min-w-0", activeSection === "players" ? "text-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-md" : "text-muted-foreground hover:text-primary hover:bg-primary/5", disabled && "opacity-50 cursor-not-allowed")}>
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] font-semibold truncate">Players</span>
          </button>

          <button onClick={() => onSectionChange("matches")} disabled={disabled} className={cn("flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all relative -mt-4 flex-1 min-w-0", activeSection === "matches" ? "text-primary" : "text-muted-foreground hover:text-primary")}>
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all mx-auto", activeSection === "matches" ? "bg-gradient-to-br from-primary via-primary to-accent shadow-sport scale-110" : "bg-gradient-to-br from-muted to-muted/60 hover:from-primary/20 hover:to-accent/20 hover:scale-105 shadow-md")}>
              <Calendar className={cn("w-7 h-7", activeSection === "matches" ? "text-white drop-shadow-lg" : "text-foreground")} />
            </div>
            <span className={cn("text-[10px] font-semibold mt-0.5 truncate", activeSection === "matches" ? "text-primary" : "")}>Matches</span>
          </button>

          <button onClick={() => onSectionChange("history")} disabled={disabled} className={cn("flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all hover:scale-105 flex-1 min-w-0", activeSection === "history" ? "text-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-md" : "text-muted-foreground hover:text-primary hover:bg-primary/5", disabled && "opacity-50 cursor-not-allowed")}>
            <History className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] font-semibold truncate">History</span>
          </button>

          <button onClick={() => onSectionChange("leaderboard")} disabled={disabled} className={cn("flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all hover:scale-105 flex-1 min-w-0", activeSection === "leaderboard" ? "text-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-md" : "text-muted-foreground hover:text-primary hover:bg-primary/5", disabled && "opacity-50 cursor-not-allowed")}>
            <Trophy className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] font-semibold truncate">Leaders</span>
          </button>
        </div>
      </div>
    </nav>;
};