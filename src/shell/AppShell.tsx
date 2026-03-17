/**
 * AppShell - Responsive Shell Foundation
 * Provides consistent layout across all variants and viewports
 */
import React from 'react';
import { useViewport } from '@/core/hooks/useViewport';
import { useShell } from './ShellContext';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

interface AppShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  bottomNav?: React.ReactNode;
  hideHeader?: boolean;
  hideBottomNav?: boolean;
  fullHeight?: boolean;
  variant?: 'classic' | 'tournament' | 'qualifier';
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  header,
  sidebar,
  bottomNav,
  hideHeader = false,
  hideBottomNav = false,
  fullHeight = true,
  variant = 'classic',
}) => {
  const { isMobilePortrait, isMobileLandscape, isTablet, isDesktop } = useViewport();
  const { isGameCodeDialogOpen } = useShell();

  // Calculate bottom padding for mobile nav (safe area + nav height)
  const bottomPadding = !hideBottomNav && (isMobilePortrait || isMobileLandscape) ? 'pb-20 sm:pb-24' : '';
  
  // Calculate sidebar width for desktop
  const sidebarWidth = isDesktop && sidebar ? 'lg:ml-64' : '';
  
  // Content max width based on viewport
  const contentMaxWidth = isDesktop ? 'max-w-5xl' : 'max-w-full';
  
  // Horizontal padding based on viewport
  const horizontalPadding = isDesktop ? 'px-6 lg:px-8' : isTablet ? 'px-4' : 'px-3';

  return (
    <div 
      className={cn(
        "min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 relative",
        fullHeight && "h-screen flex flex-col"
      )}
    >
      {/* Decorative background elements - subtle on mobile */}
      <div className="absolute inset-0 opacity-[0.03] sm:opacity-5 pointer-events-none overflow-hidden">
        <div className="absolute top-10 sm:top-20 right-5 sm:right-10 w-32 sm:w-64 h-32 sm:h-64 bg-primary rounded-full blur-3xl" />
        <div className="absolute bottom-10 sm:bottom-20 left-5 sm:left-10 w-48 sm:w-96 h-48 sm:h-96 bg-accent rounded-full blur-3xl" />
      </div>

      {/* Left Ad Sidebar - Desktop Only (hidden on smaller screens) */}
      {isDesktop && (
        <div className="hidden xl:block fixed left-2 top-1/2 -translate-y-1/2 w-32 2xl:w-40 z-20">
          <ins 
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client="ca-pub-6788044289759238"
            data-ad-slot="3260817680"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      )}

      {/* Right Ad Sidebar - Desktop Only (hidden on smaller screens) */}
      {isDesktop && (
        <div className="hidden xl:block fixed right-2 top-1/2 -translate-y-1/2 w-32 2xl:w-40 z-20">
          <ins 
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client="ca-pub-6788044289759238"
            data-ad-slot="3560485991"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      )}

      {/* Desktop Sidebar - slides in from left on lg+ screens */}
      {isDesktop && sidebar && (
        <aside className="fixed left-0 top-0 h-full w-60 lg:w-64 bg-card/95 backdrop-blur-sm border-r z-30 hidden lg:block">
          {sidebar}
        </aside>
      )}

      {/* Main Content Area */}
      <main 
        className={cn(
          "relative z-10 flex-1 flex flex-col",
          sidebarWidth,
          bottomPadding,
          horizontalPadding,
          contentMaxWidth,
          "mx-auto w-full"
        )}
      >
        {/* Default Header (can be overridden) - responsive sizing */}
        {!hideHeader && !header && (
          <header className="text-center py-2 sm:py-3 flex-shrink-0">
            <div className="flex items-center justify-center mb-1 sm:mb-2">
              <img 
                src={logo} 
                alt="PickleballMatch.Fun" 
                className="h-8 sm:h-10 md:h-12 lg:h-14 w-auto" 
              />
            </div>
            <p className="text-muted-foreground text-[10px] sm:text-xs md:text-sm font-medium leading-relaxed px-1 sm:px-2 lg:px-0">
              🎾 Smart team assignment & scoring. Live match scheduling with multi-court management. 🏓
            </p>
          </header>
        )}

        {/* Custom Header */}
        {header && (
          <header className="flex-shrink-0">
            {header}
          </header>
        )}

        {/* Content - with safe area handling */}
        <div className={cn(
          "flex-1 flex flex-col min-h-0",
          // Extra bottom margin on mobile for safe areas
          !hideBottomNav && (isMobilePortrait || isMobileLandscape) && "mb-safe"
        )}>
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile/Tablet with safe area support */}
      {!hideBottomNav && (isMobilePortrait || isMobileLandscape || isTablet) && bottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
          {bottomNav}
        </nav>
      )}

      {/* Desktop Navigation - Top nav bar when no sidebar */}
      {isDesktop && bottomNav && !sidebar && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t hidden lg:block">
          <div className="max-w-5xl mx-auto px-6 lg:px-8">
            {bottomNav}
          </div>
        </nav>
      )}
    </div>
  );
}

export default AppShell;
