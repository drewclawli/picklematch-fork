import { supabase } from "@/integrations/supabase/client";

const STORAGE_PREFIX = "teamup_player_";

export interface PlayerIdentity {
  playerName: string;
  gameId: string;
  deviceId: string;
}

// Generate a unique device ID for this browser
export const getDeviceId = (): string => {
  const storageKey = "teamup_device_id";
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(storageKey, deviceId);
  }
  
  return deviceId;
};

// Get the player identity for a specific game
export const getPlayerIdentity = (gameId: string): string | null => {
  return localStorage.getItem(`${STORAGE_PREFIX}name_${gameId}`);
};

// Set the player identity for a specific game
export const setPlayerIdentity = async (gameId: string, playerName: string): Promise<void> => {
  const deviceId = getDeviceId();
  localStorage.setItem(`${STORAGE_PREFIX}name_${gameId}`, playerName);
  
  // Upsert to player_devices table
  const { error } = await supabase
    .from("player_devices")
    .upsert({
      game_id: gameId,
      player_name: playerName,
      device_id: deviceId,
      status: "active",
      last_active: new Date().toISOString(),
    }, {
      onConflict: "game_id,player_name,device_id",
    });
  
  if (error) {
    console.error("Error setting player identity:", error);
    throw error;
  }
};

// Clear the player identity for a specific game
export const clearPlayerIdentity = async (gameId: string): Promise<void> => {
  const playerName = getPlayerIdentity(gameId);
  if (!playerName) return;
  
  const deviceId = getDeviceId();
  localStorage.removeItem(`${STORAGE_PREFIX}name_${gameId}`);
  
  // Mark as left_game in database
  const { error } = await supabase
    .from("player_devices")
    .update({ status: "left_game" })
    .eq("game_id", gameId)
    .eq("player_name", playerName)
    .eq("device_id", deviceId);
  
  if (error) {
    console.error("Error clearing player identity:", error);
  }
};

// Get notification preferences
export const getNotificationPreferences = (gameId: string) => {
  const key = `${STORAGE_PREFIX}notifications_${gameId}`;
  const stored = localStorage.getItem(key);
  
  if (!stored) {
    return {
      enabled: true,
      twoMatchesAhead: true,
      onDeck: true,
      matchStarting: true,
    };
  }
  
  return JSON.parse(stored);
};

// Set notification preferences
export const setNotificationPreferences = (gameId: string, preferences: any) => {
  const key = `${STORAGE_PREFIX}notifications_${gameId}`;
  localStorage.setItem(key, JSON.stringify(preferences));
};

// Update player's skip status
export const setSkipNextMatch = async (
  gameId: string,
  playerName: string,
  skip: boolean
): Promise<void> => {
  const deviceId = getDeviceId();
  
  const { error } = await supabase
    .from("player_devices")
    .update({ skip_next_match: skip })
    .eq("game_id", gameId)
    .eq("player_name", playerName)
    .eq("device_id", deviceId);
  
  if (error) {
    console.error("Error setting skip status:", error);
    throw error;
  }
};

// Update last active timestamp
export const updateLastActive = async (gameId: string, playerName: string): Promise<void> => {
  const deviceId = getDeviceId();
  
  await supabase
    .from("player_devices")
    .update({ last_active: new Date().toISOString() })
    .eq("game_id", gameId)
    .eq("player_name", playerName)
    .eq("device_id", deviceId);
};
