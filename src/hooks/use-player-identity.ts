import { useState, useEffect } from "react";
import { getPlayerIdentity, setPlayerIdentity, clearPlayerIdentity, updateLastActive } from "@/lib/player-identity";

export const usePlayerIdentity = (gameId: string | null) => {
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameId) {
      setPlayerName(null);
      setIsLoading(false);
      return;
    }

    const storedName = getPlayerIdentity(gameId);
    setPlayerName(storedName);
    setIsLoading(false);

    // Update last active every 30 seconds if identity is set
    if (storedName) {
      updateLastActive(gameId, storedName);
      
      const interval = setInterval(() => {
        updateLastActive(gameId, storedName);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [gameId]);

  const claimIdentity = async (name: string) => {
    if (!gameId) return;
    
    await setPlayerIdentity(gameId, name);
    setPlayerName(name);
  };

  const releaseIdentity = async () => {
    if (!gameId) return;
    
    await clearPlayerIdentity(gameId);
    setPlayerName(null);
  };

  return {
    playerName,
    isPlayerView: !!playerName,
    isLoading,
    claimIdentity,
    releaseIdentity,
  };
};
