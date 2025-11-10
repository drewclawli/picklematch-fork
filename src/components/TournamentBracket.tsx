import { useState } from "react";
import { Match } from "@/lib/scheduler";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, Check, Crown } from "lucide-react";
import { validateMatchScore } from "@/lib/validation";
import { toast } from "sonner";

interface TournamentBracketProps {
  matches: Match[];
  matchScores: Map<string, { team1: number; team2: number }>;
  onScoreUpdate: (matchId: string, team1: number, team2: number) => void;
  courtElapsedTimes?: Map<number, number>;
  isPlayerView?: boolean;
  playerName?: string;
}

export const TournamentBracket = ({
  matches,
  matchScores,
  onScoreUpdate,
  courtElapsedTimes,
  isPlayerView = false,
  playerName
}: TournamentBracketProps) => {
  const [pendingScores, setPendingScores] = useState<Map<string, { team1: string; team2: string }>>(new Map());

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Organize matches by bracket structure
  const bracketType = matches[0]?.tournamentMetadata?.bracketType;
  const isDoubleElimination = bracketType === 'winners' || matches.some(m => m.tournamentMetadata?.bracketType === 'losers');
  
  // Group matches by round for single elimination or bracket type for double elimination
  const rounds = new Map<number, Match[]>();
  const winnersBracket: Match[] = [];
  const losersBracket: Match[] = [];
  let finalsMatch: Match | null = null;
  let grandFinalsMatch: Match | null = null;
  let thirdPlaceMatch: Match | null = null;

  matches.forEach(match => {
    const metadata = match.tournamentMetadata;
    if (!metadata) return;

    if (isDoubleElimination) {
      if (metadata.bracketType === 'winners') {
        winnersBracket.push(match);
      } else if (metadata.bracketType === 'losers') {
        losersBracket.push(match);
      } else if (metadata.bracketType === 'grand-finals') {
        grandFinalsMatch = match;
      }
    } else {
      if (metadata.bracketType === 'finals') {
        finalsMatch = match;
      } else if (metadata.bracketType === 'third-place') {
        thirdPlaceMatch = match;
      } else {
        const round = metadata.round;
        if (!rounds.has(round)) {
          rounds.set(round, []);
        }
        rounds.get(round)!.push(match);
      }
    }
  });

  // Sort rounds
  const sortedRounds = Array.from(rounds.keys()).sort((a, b) => a - b);

  // Determine match status
  const getMatchStatus = (match: Match) => {
    if (matchScores.has(match.id)) return 'completed';
    if (match.team1[0] === 'TBD' || match.team2[0] === 'TBD') return 'waiting';
    
    // Check if all prerequisite matches are complete
    const allPriorRounds = matches.filter(m => {
      if (!m.tournamentMetadata || !match.tournamentMetadata) return false;
      return m.tournamentMetadata.round < match.tournamentMetadata.round;
    });
    
    const allPriorComplete = allPriorRounds.every(m => matchScores.has(m.id) || m.team1[0] === 'TBD' || m.team2[0] === 'TBD');
    
    if (allPriorComplete) return 'ready';
    return 'scheduled';
  };

  const updatePendingScore = (matchId: string, team: 'team1' | 'team2', value: string) => {
    if (value === '') {
      const current = pendingScores.get(matchId) || { team1: '', team2: '' };
      const newPending = new Map(pendingScores);
      newPending.set(matchId, { ...current, [team]: '' });
      setPendingScores(newPending);
      return;
    }

    const validation = validateMatchScore(value);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid score");
      return;
    }

    const current = pendingScores.get(matchId) || { team1: '', team2: '' };
    const newPending = new Map(pendingScores);
    newPending.set(matchId, { ...current, [team]: validation.value!.toString() });
    setPendingScores(newPending);
  };

  const confirmScore = (matchId: string) => {
    const pending = pendingScores.get(matchId);
    if (!pending || pending.team1 === '' || pending.team2 === '') {
      toast.error("Please enter both scores");
      return;
    }

    const team1Score = Number(pending.team1);
    const team2Score = Number(pending.team2);

    onScoreUpdate(matchId, team1Score, team2Score);

    const newPending = new Map(pendingScores);
    newPending.delete(matchId);
    setPendingScores(newPending);
  };

  const renderMatchCard = (match: Match, isCompact: boolean = false) => {
    const status = getMatchStatus(match);
    const score = matchScores.get(match.id);
    const pending = pendingScores.get(match.id);
    const metadata = match.tournamentMetadata!;

    // Don't render matches where both teams are TBD (shouldn't exist anyway)
    if (match.team1[0] === 'TBD' && match.team2[0] === 'TBD') {
      return null;
    }

    // Filter for player view
    if (isPlayerView && playerName) {
      const hasPlayer = match.team1.some(p => p === playerName) || match.team2.some(p => p === playerName);
      if (!hasPlayer && status !== 'ready') return null;
    }

    const getBorderColor = () => {
      if (status === 'completed') return 'border-primary/40 bg-primary/5';
      if (status === 'ready') return 'border-accent bg-accent/10';
      if (status === 'waiting') return 'border-border/30 bg-muted/20';
      return 'border-border bg-card';
    };

    const isWinner = (team: 'team1' | 'team2') => {
      if (!score) return false;
      return team === 'team1' ? score.team1 > score.team2 : score.team2 > score.team1;
    };

    // Get player label for TBD players
    const getPlayerLabel = (teamSlot: 'team1' | 'team2') => {
      const player = match[teamSlot][0];
      if (player !== 'TBD') return player;
      
      // Find which source match feeds into this slot
      const { sourceMatch1, sourceMatch2 } = metadata;
      
      // team1 comes from sourceMatch1, team2 comes from sourceMatch2
      const sourceMatchId = teamSlot === 'team1' ? sourceMatch1 : sourceMatch2;
      
      if (sourceMatchId) {
        const sourceMatch = matches.find(m => m.id === sourceMatchId);
        if (sourceMatch) {
          const sourceRoundName = sourceMatch.tournamentMetadata?.roundName || '';
          const sourceMatchNum = sourceMatch.tournamentMetadata?.matchNumber || '';
          return `Winner of ${sourceRoundName} #${sourceMatchNum}`;
        }
      }
      
      return 'TBD';
    };

    return (
      <Card key={match.id} className={`${getBorderColor()} transition-all ${isCompact ? 'p-2' : 'p-3'} relative`}>
        {/* Seed indicators */}
        {metadata.seed1 && metadata.seed2 && !isCompact && (
          <div className="absolute -left-2 -top-2 bg-muted rounded-full w-5 h-5 flex items-center justify-center text-[8px] font-bold border">
            {metadata.seed1}
          </div>
        )}
        
        {/* Team 1 */}
        <div className={`flex items-center justify-between py-1.5 px-2 rounded ${
          status === 'waiting' ? 'bg-muted/30' : 'bg-background/50'
        } mb-1 relative`}>
          {isWinner('team1') && (
            <Crown className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 text-primary fill-primary" />
          )}
          <span className={`text-[10px] font-medium ${
            match.team1[0] === 'TBD' ? 'text-muted-foreground italic' : 'text-foreground'
          } ${isWinner('team1') ? 'font-bold text-primary ml-3' : ''} truncate`}>
            {getPlayerLabel('team1')}
          </span>
          {status === 'ready' && !score ? (
            <Input
              type="text"
              inputMode="numeric"
              className="w-12 h-6 text-center text-xs p-0"
              placeholder="0"
              value={pending?.team1 || ''}
              onChange={(e) => updatePendingScore(match.id, 'team1', e.target.value)}
            />
          ) : (
            <span className={`text-xs font-bold min-w-[20px] text-right ${
              isWinner('team1') ? 'text-primary' : 'text-foreground'
            }`}>
              {score?.team1 ?? '-'}
            </span>
          )}
        </div>

        {/* Team 2 */}
        <div className={`flex items-center justify-between py-1.5 px-2 rounded ${
          status === 'waiting' ? 'bg-muted/30' : 'bg-background/50'
        } relative`}>
          {isWinner('team2') && (
            <Crown className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 text-primary fill-primary" />
          )}
          <span className={`text-[10px] font-medium ${
            match.team2[0] === 'TBD' ? 'text-muted-foreground italic' : 'text-foreground'
          } ${isWinner('team2') ? 'font-bold text-primary ml-3' : ''} truncate`}>
            {getPlayerLabel('team2')}
          </span>
          {status === 'ready' && !score ? (
            <Input
              type="text"
              inputMode="numeric"
              className="w-12 h-6 text-center text-xs p-0"
              placeholder="0"
              value={pending?.team2 || ''}
              onChange={(e) => updatePendingScore(match.id, 'team2', e.target.value)}
            />
          ) : (
            <span className={`text-xs font-bold min-w-[20px] text-right ${
              isWinner('team2') ? 'text-primary' : 'text-foreground'
            }`}>
              {score?.team2 ?? '-'}
            </span>
          )}
        </div>

        {/* Confirm Button */}
        {status === 'ready' && !score && (
          <Button
            onClick={() => confirmScore(match.id)}
            size="sm"
            className="w-full h-6 text-[10px] mt-1"
          >
            Confirm
          </Button>
        )}

        {/* Status indicator for seed display on compact */}
        {isCompact && metadata.seed1 && metadata.seed2 && (
          <div className="text-center text-[8px] text-muted-foreground mt-0.5">
            #{metadata.seed1} vs #{metadata.seed2}
          </div>
        )}
      </Card>
    );
  };

  const renderBracketConnector = () => (
    <div className="flex items-center justify-center mx-1">
      <div className="w-4 border-t-2 border-border"></div>
    </div>
  );

  const renderRoundConnector = () => (
    <div className="hidden sm:flex items-center justify-center">
      <svg width="40" height="100%" className="text-border">
        <line x1="0" y1="50%" x2="40" y2="50%" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );

  // Render single elimination bracket
  const renderSingleEliminationBracket = () => {
    return (
      <div className="space-y-6">
        <div className="flex overflow-x-auto pb-4 gap-6">
          {sortedRounds.map((roundNum, roundIdx) => {
            const roundMatches = rounds.get(roundNum)!.filter(m => 
              !(m.team1[0] === 'TBD' && m.team2[0] === 'TBD')
            );
            
            if (roundMatches.length === 0) return null;
            
            const roundName = roundMatches[0]?.tournamentMetadata?.roundName || `Round ${roundNum}`;
            
            return (
              <div key={roundNum} className="flex-shrink-0 min-w-[220px]">
                <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-3">
                  <h3 className="text-sm font-bold text-center text-foreground uppercase tracking-wide px-2 py-2 rounded-lg border-b-2 border-primary/20">
                    {roundName}
                  </h3>
                  <p className="text-[10px] text-center text-muted-foreground mt-1">
                    {roundMatches.length} {roundMatches.length === 1 ? 'match' : 'matches'}
                  </p>
                </div>
                <div className="space-y-6 mt-4">
                  {roundMatches.map((match, idx) => {
                    const card = renderMatchCard(match);
                    if (!card) return null;
                    
                    return (
                      <div key={match.id} className="relative">
                        {card}
                        
                        {/* Connector line to next round */}
                        {roundIdx < sortedRounds.length - 1 && (
                          <div className="absolute left-full top-1/2 w-6 border-t-2 border-primary/30 -translate-y-1/2">
                            <div className="absolute right-0 top-0 w-2 h-2 bg-primary/30 rounded-full -translate-y-1/2"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {/* Finals */}
          {finalsMatch && !(finalsMatch.team1[0] === 'TBD' && finalsMatch.team2[0] === 'TBD') && (
            <div className="flex-shrink-0 min-w-[240px]">
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-3">
                <h3 className="text-sm font-bold text-center text-foreground uppercase tracking-wide px-2 py-2 rounded-lg border-b-2 border-primary flex items-center justify-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Championship
                </h3>
              </div>
              <div className="flex items-center justify-center mt-4">
                {renderMatchCard(finalsMatch)}
              </div>
            </div>
          )}
        </div>
        
        {/* Third Place Match */}
        {thirdPlaceMatch && !(thirdPlaceMatch.team1[0] === 'TBD' && thirdPlaceMatch.team2[0] === 'TBD') && (
          <div className="mt-8 pt-6 border-t border-border/50">
            <h3 className="text-sm font-bold text-center text-foreground uppercase tracking-wide mb-4 flex items-center justify-center gap-2">
              <Badge variant="outline" className="text-xs">3rd Place</Badge>
            </h3>
            <div className="flex justify-center">
              <div className="w-[220px]">
                {renderMatchCard(thirdPlaceMatch)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render double elimination bracket
  const renderDoubleEliminationBracket = () => {
    // Group winners bracket by round
    const winnersRounds = new Map<number, Match[]>();
    winnersBracket.forEach(match => {
      const round = match.tournamentMetadata!.round;
      if (!winnersRounds.has(round)) {
        winnersRounds.set(round, []);
      }
      winnersRounds.get(round)!.push(match);
    });

    const sortedWinnersRounds = Array.from(winnersRounds.keys()).sort((a, b) => a - b);

    return (
      <div className="space-y-8">
        {/* Winners Bracket */}
        <div>
          <h2 className="text-sm font-bold text-primary mb-4 flex items-center gap-2 border-b border-primary/20 pb-2">
            <Trophy className="w-5 h-5" />
            Winners Bracket
          </h2>
          <div className="flex overflow-x-auto pb-4 gap-6">
            {sortedWinnersRounds.map((roundNum, roundIdx) => {
              const roundMatches = winnersRounds.get(roundNum)!.filter(m => 
                !(m.team1[0] === 'TBD' && m.team2[0] === 'TBD')
              );
              
              if (roundMatches.length === 0) return null;
              
              const roundName = roundMatches[0]?.tournamentMetadata?.roundName || `Round ${roundNum}`;
              
              return (
                <div key={roundNum} className="flex-shrink-0 min-w-[200px]">
                  <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-3">
                    <h3 className="text-xs font-bold text-center text-foreground uppercase tracking-wide px-2 py-2 rounded-lg border-b border-primary/20">
                      {roundName}
                    </h3>
                  </div>
                  <div className="space-y-4 mt-4">
                    {roundMatches.map(match => {
                      const card = renderMatchCard(match, true);
                      if (!card) return null;
                      
                      return (
                        <div key={match.id} className="relative">
                          {card}
                          {roundIdx < sortedWinnersRounds.length - 1 && (
                            <div className="absolute left-full top-1/2 w-6 border-t-2 border-primary/20 -translate-y-1/2">
                              <div className="absolute right-0 top-0 w-2 h-2 bg-primary/30 rounded-full -translate-y-1/2"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Losers Bracket */}
        {losersBracket.length > 0 && (
          <div className="pt-6 border-t border-border/50">
            <h2 className="text-sm font-bold text-muted-foreground mb-4 flex items-center gap-2 border-b border-muted-foreground/20 pb-2">
              Losers Bracket
            </h2>
            <div className="flex overflow-x-auto pb-4 gap-6">
              {losersBracket.filter(m => !(m.team1[0] === 'TBD' && m.team2[0] === 'TBD')).map(match => {
                const card = renderMatchCard(match, true);
                if (!card) return null;
                
                return (
                  <div key={match.id} className="flex-shrink-0 min-w-[200px]">
                    {card}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Grand Finals */}
        {grandFinalsMatch && !(grandFinalsMatch.team1[0] === 'TBD' && grandFinalsMatch.team2[0] === 'TBD') && (
          <div className="mt-8 pt-6 border-t border-border/50">
            <h3 className="text-base font-bold text-center text-foreground uppercase tracking-wide mb-4 flex items-center justify-center gap-2 border-b-2 border-primary pb-2">
              <Trophy className="w-6 h-6 text-primary" />
              Grand Finals
            </h3>
            <div className="flex justify-center">
              <div className="w-[240px]">
                {renderMatchCard(grandFinalsMatch)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Tournament Bracket</h2>
            <p className="text-xs text-muted-foreground">
              {isDoubleElimination ? 'Double Elimination' : 'Single Elimination'}
            </p>
          </div>
        </div>
      </div>

      {/* Bracket Display */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isDoubleElimination ? renderDoubleEliminationBracket() : renderSingleEliminationBracket()}
      </div>
    </div>
  );
};
