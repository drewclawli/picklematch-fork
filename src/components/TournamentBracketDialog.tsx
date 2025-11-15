import { Match } from "@/lib/scheduler";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TournamentBracketView } from "./TournamentBracketView";

interface TournamentBracketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: Match[];
  matchScores: Map<string, { team1: number; team2: number }>;
  allPlayers: string[];
  schedulingType: 'single-elimination' | 'double-elimination' | 'qualifier-tournament';
}

export function TournamentBracketDialog({
  open,
  onOpenChange,
  matches,
  matchScores,
  allPlayers,
  schedulingType,
}: TournamentBracketDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] w-[95vw] sm:w-full overflow-hidden flex flex-col p-3 sm:p-6" aria-labelledby="bracket-dialog-title" aria-describedby="bracket-dialog-description">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle id="bracket-dialog-title" className="text-base sm:text-lg">Tournament Bracket</DialogTitle>
          <DialogDescription id="bracket-dialog-description" className="text-xs sm:text-sm">
            {schedulingType === 'single-elimination'
              ? 'Single Elimination - One loss and you\'re out'
              : schedulingType === 'double-elimination'
              ? 'Double Elimination - Two chances to stay in'
              : 'Qualifier Tournament - Groups then knockout'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-3 sm:-mx-6 px-3 sm:px-6 mt-3 sm:mt-4">
          <TournamentBracketView
            matches={matches}
            matchScores={matchScores}
            allPlayers={allPlayers}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
