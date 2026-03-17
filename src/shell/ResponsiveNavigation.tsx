/**
 * ResponsiveNavigation - Modern navigation that adapts to viewport
 * Mobile Portrait: Bottom tab bar (5 icons)
 * Mobile Landscape: Side rail or compact bottom bar
 * Tablet: Collapsible side rail or bottom nav
 * Desktop: Sidebar navigation
 */
import React from 'react';
import { 
  Settings2, 
  Users, 
  Calendar, 
  Trophy, 
  History,
  UserCircle,
  ChevronLeft,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useViewport } from '@/core/hooks/useViewport';
import { useShell } from '@/shell/ShellContext';
import type { Section } from '@/core/types';
import { Button } from '@/components/ui/button';

interface NavItem {
  id: Section;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

interface ResponsiveNavigationProps {
  disabled?: boolean;
  onBack?: () => void;
  showBackButton?: boolean;
  className?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'setup', label: 'Setup', shortLabel: 'Setup', icon: <Settings2 className="w-5 h-5" /> },
  { id: 'players', label: 'Players', shortLabel: 'Players', icon: <Users className="w-5 h-5" /> },
  { id: 'matches', label: 'Matches', shortLabel: 'Play', icon: <Calendar className="w-5 h-5" /> },
  { id: 'leaderboard', label: 'Standings', shortLabel: 'Ranks', icon: <Trophy className="w-5 h-5" /> },
  { id: 'history', label: 'History', shortLabel: 'History', icon: <History className="w-5 h-5" /> },
];

export const MobileBottomNav: React.FC<ResponsiveNavigationProps> = ({
  disabled = false,
  className,
}) => {
  const { activeSection, setActiveSection, isPlayerView } = useShell();
  const { isMobileLandscape } = useViewport();

  return (
    <div 
      className={cn(
        "bg-card/95 backdrop-blur-md border-t border-border/50",
        "safe-area-bottom",
        className
      )}
    >
      <div className={cn(
        "flex items-center justify-around",
        isMobileLandscape ? "h-12" : "h-16 sm:h-14"
      )}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => !disabled && !item.disabled && setActiveSection(item.id)}
            disabled={disabled || item.disabled}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full relative",
              "transition-colors duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset",
              activeSection === item.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
              (disabled || item.disabled) && "opacity-50 cursor-not-allowed"
            )}
            aria-label={item.label}
            aria-current={activeSection === item.id ? 'page' : undefined}
          >
            <span className={cn(
              "transition-transform duration-200",
              activeSection === item.id && "scale-110"
            )}>
              {item.icon}
            </span>
            <span className={cn(
              "font-medium",
              isMobileLandscape ? "text-[9px] mt-0" : "text-[10px] sm:text-xs mt-0.5"
            )}>
              {isMobileLandscape ? item.shortLabel : item.label}
            </span>
            {activeSection === item.id && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export const MobileLandscapeSideNav: React.FC<ResponsiveNavigationProps> = ({
  disabled = false,
  className,
}) => {
  const { activeSection, setActiveSection } = useShell();

  return (
    <div 
      className={cn(
        "fixed left-0 top-0 h-full w-16 bg-card/95 backdrop-blur-md border-r border-border/50 z-50",
        "flex flex-col items-center py-4 gap-2",
        className
      )}
    >
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => !disabled && !item.disabled && setActiveSection(item.id)}
          disabled={disabled || item.disabled}
          className={cn(
            "w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5",
            "transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            activeSection === item.id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            (disabled || item.disabled) && "opacity-50 cursor-not-allowed"
          )}
          aria-label={item.label}
          aria-current={activeSection === item.id ? 'page' : undefined}
        >
          {item.icon}
          <span className="text-[8px] font-medium">{item.shortLabel}</span>
        </button>
      ))}
    </div>
  );
};

// Issue #5: Get variant label for display
const getVariantLabel = (variant: string): string => {
  switch (variant) {
    case 'tournament': return 'Tournament Mode';
    case 'qualifier': return 'Qualifier Mode';
    case 'classic':
    default: return 'Classic Mode';
  }
};

export const DesktopSidebar: React.FC<ResponsiveNavigationProps> = ({
  disabled = false,
  className,
}) => {
  const { activeSection, setActiveSection, variant } = useShell();

  return (
    <div className={cn("flex flex-col h-full py-4 lg:py-6", className)}>
      <div className="px-3 lg:px-4 mb-4 lg:mb-6">
        <h2 className="text-base lg:text-lg font-semibold text-foreground">PickleMatch</h2>
        <p className="text-[10px] lg:text-xs text-muted-foreground mt-0.5 lg:mt-1">Tournament Manager</p>
      </div>

      <nav className="flex-1 px-2 lg:px-3 space-y-0.5 lg:space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => !disabled && !item.disabled && setActiveSection(item.id)}
            disabled={disabled || item.disabled}
            className={cn(
              "w-full flex items-center gap-2 lg:gap-3 px-2 lg:px-3 py-2 lg:py-2.5 rounded-lg",
              "transition-all duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              activeSection === item.id
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              (disabled || item.disabled) && "opacity-50 cursor-not-allowed"
            )}
            aria-current={activeSection === item.id ? 'page' : undefined}
          >
            {item.icon}
            <span className="text-sm">{item.label}</span>
            {activeSection === item.id && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            )}
          </button>
        ))}
      </nav>

      <div className="px-3 lg:px-4 pt-4 lg:pt-6 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground">
          v2.0 • {getVariantLabel(variant)}
        </p>
      </div>
    </div>
  );
};

export const PlayerViewHeader: React.FC<{
  playerName: string;
  onExit: () => void;
}> = ({ playerName, onExit }) => {
  const { isMobilePortrait, isMobileLandscape } = useViewport();

  return (
    <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-primary/5 border-b border-primary/10">
      <div className="flex items-center gap-2">
        <UserCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <span className="font-medium text-xs sm:text-sm truncate max-w-[150px] sm:max-w-[200px]">
          Playing as: {playerName}
        </span>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onExit}
        className="h-7 sm:h-8 text-xs"
      >
        {isMobilePortrait ? 'Exit' : 'Exit Player View'}
      </Button>
    </div>
  );
};

export const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = (props) => {
  const { isDesktop, isMobileLandscape, isTablet } = useViewport();
  
  // Desktop gets sidebar
  if (isDesktop) {
    return <DesktopSidebar {...props} />;
  }
  
  // Mobile landscape could use side rail (optional) or compact bottom bar
  // Using compact bottom bar for consistency
  return <MobileBottomNav {...props} />;
};

export default ResponsiveNavigation;
