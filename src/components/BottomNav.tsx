import { Settings, Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeSection: "setup" | "scheduler" | "checkin";
  onSectionChange: (section: "setup" | "scheduler" | "checkin") => void;
  disabled?: boolean;
}

export const BottomNav = ({ activeSection, onSectionChange, disabled }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-around py-3">
          <button
            onClick={() => onSectionChange("setup")}
            disabled={disabled}
            className={cn(
              "flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all",
              activeSection === "setup"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-medium">Setup</span>
          </button>

          <button
            onClick={() => onSectionChange("scheduler")}
            disabled={disabled}
            className={cn(
              "flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all relative",
              activeSection === "scheduler"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all",
                activeSection === "scheduler"
                  ? "bg-gradient-to-br from-primary to-accent shadow-lg scale-110"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <span className="text-xs font-medium mt-1">Scheduler</span>
          </button>

          <button
            onClick={() => onSectionChange("checkin")}
            disabled={disabled}
            className={cn(
              "flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all",
              activeSection === "checkin"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Users className="w-6 h-6" />
            <span className="text-xs font-medium">Check In</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
