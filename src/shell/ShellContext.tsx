/**
 * Shell Context - Manages app shell state
 * Navigation, layout mode, and responsive behavior
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Section, VariantType } from '@/core/types';

interface ShellContextState {
  // Navigation
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  
  // Variant
  variant: VariantType;
  setVariant: (variant: VariantType) => void;
  
  // Layout
  isPlayerView: boolean;
  setIsPlayerView: (isPlayer: boolean) => void;
  playerName: string | null;
  setPlayerName: (name: string | null) => void;
  
  // UI State
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isGameCodeDialogOpen: boolean;
  setIsGameCodeDialogOpen: (open: boolean) => void;
  
  // Actions
  resetToSetup: () => void;
  enterPlayerView: (name: string) => void;
  exitPlayerView: () => void;
}

const ShellContext = createContext<ShellContextState | undefined>(undefined);

export const ShellProvider: React.FC<{
  children: React.ReactNode;
  initialVariant?: VariantType;
}> = ({ children, initialVariant = 'classic' }) => {
  const [activeSection, setActiveSection] = useState<Section>('setup');
  // Issue #5: variant should reflect the current URL path, not just initial
  const [variant, setVariant] = useState<VariantType>(initialVariant);

  // Sync variant with URL path on mount and when location changes
  useEffect(() => {
    const updateVariantFromPath = () => {
      const path = window.location.pathname;
      if (path.includes('/tournament')) {
        setVariant('tournament');
      } else if (path.includes('/qualifier')) {
        setVariant('qualifier');
      } else if (path.includes('/classic')) {
        setVariant('classic');
      }
    };

    updateVariantFromPath();

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', updateVariantFromPath);
    return () => window.removeEventListener('popstate', updateVariantFromPath);
  }, []);
  const [isPlayerView, setIsPlayerView] = useState(false);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGameCodeDialogOpen, setIsGameCodeDialogOpen] = useState(true);

  const resetToSetup = useCallback(() => {
    setActiveSection('setup');
    setIsPlayerView(false);
    setPlayerName(null);
    setIsGameCodeDialogOpen(true);
  }, []);

  const enterPlayerView = useCallback((name: string) => {
    setPlayerName(name);
    setIsPlayerView(true);
  }, []);

  const exitPlayerView = useCallback(() => {
    setIsPlayerView(false);
    setPlayerName(null);
  }, []);

  return (
    <ShellContext.Provider
      value={{
        activeSection,
        setActiveSection,
        variant,
        setVariant,
        isPlayerView,
        setIsPlayerView,
        playerName,
        setPlayerName,
        isSidebarOpen,
        setIsSidebarOpen,
        isGameCodeDialogOpen,
        setIsGameCodeDialogOpen,
        resetToSetup,
        enterPlayerView,
        exitPlayerView,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
};

export const useShell = (): ShellContextState => {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell must be used within a ShellProvider');
  }
  return context;
};
