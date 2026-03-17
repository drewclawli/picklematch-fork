/**
 * Core Types for PickleMatch
 * Shared across all variants
 */

export interface CourtConfig {
  courtNumber: number;
  type: 'singles' | 'doubles';
}

export interface Match {
  id: string;
  court: number;
  startTime: number;
  endTime: number;
  team1: string[];
  team2: string[];
  score?: {
    team1: number;
    team2: number;
  };
  isBye?: boolean;
  round?: number;
  matchNumber?: number;
  // Issue #2: actual-end-time plumbing for schedule adjustment
  actualEndTime?: number;
  timerStartTime?: number;
  clockStartTime?: string;
  status?: 'scheduled' | 'in-progress' | 'completed' | 'waiting' | 'bye';
  isSingles?: boolean;
  isLocked?: boolean;
  elapsedTime?: string;
  // Tournament/Qualifier metadata
  tournamentMetadata?: {
    bracketType: 'winners' | 'losers' | 'finals' | 'grand-finals' | 'third-place';
    round: number;
    roundName: string;
    matchNumber: number;
    bracketPosition?: string;
    advancesTo?: string;
    advancesToSlot?: 'team1' | 'team2';
    loserAdvancesTo?: string;
    loserAdvancesToSlot?: 'team1' | 'team2';
    sourceMatch1?: string;
    sourceMatch2?: string;
    seed1?: number;
    seed2?: number;
  };
  qualifierMetadata?: {
    groupId: string;
    groupSize: 2 | 3 | 4;
    groupMatchNum: number;
    isGroupStage: boolean;
    advancesToKnockout?: boolean;
    isGroupSemifinal?: boolean;
    isGroupFinal?: boolean;
    advancesToGroupMatch?: string;
    sourceGroupMatch1?: string;
    sourceGroupMatch2?: string;
  };
}

export type SchedulingType = 
  | 'round-robin' 
  | 'single-elimination' 
  | 'double-elimination' 
  | 'qualifier-tournament';

export type TournamentPlayStyle = 'singles' | 'doubles';

export interface GameConfig {
  gameDuration: number;
  totalTime: number;
  courts: number;
  teammatePairs?: TeammatePair[];
  courtConfigs?: CourtConfig[];
  schedulingType?: SchedulingType;
  tournamentPlayStyle?: TournamentPlayStyle;
}

export interface TeammatePair {
  player1: string;
  player2: string;
}

export interface GameState {
  id: string;
  gameCode: string;
  players: string[];
  matches: Match[];
  gameConfig: GameConfig;
  creatorId: string;
}

export type VariantType = 'classic' | 'tournament' | 'qualifier';

export interface PlayerIdentity {
  playerName: string | null;
  isPlayerView: boolean;
}

export type Section = 'setup' | 'players' | 'matches' | 'history' | 'leaderboard';

export type ViewportSize = 'mobile-portrait' | 'mobile-landscape' | 'tablet' | 'desktop';
