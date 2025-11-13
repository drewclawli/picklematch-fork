import { useEffect, useRef } from "react";
import { Match } from "@/lib/scheduler";
import { toast } from "@/hooks/use-toast";
import { getNotificationPreferences } from "@/lib/player-identity";

export const usePlayerNotifications = (
  matches: Match[],
  playerName: string | null,
  gameId: string | null,
  matchScores: Map<string, { team1: number; team2: number }>
) => {
  const notifiedMatches = useRef<Set<string>>(new Set());
  const hasRequestedPermission = useRef(false);

  // Request notification permission once with proper error handling
  useEffect(() => {
    if (!playerName || !gameId || hasRequestedPermission.current) return;

    const prefs = getNotificationPreferences(gameId);
    if (prefs.enabled && "Notification" in window && Notification.permission === "default") {
      // Use async/await for proper error handling
      (async () => {
        try {
          await Notification.requestPermission();
          hasRequestedPermission.current = true;
        } catch (error) {
          console.warn('Failed to request notification permission:', error);
          // Don't block app functionality if notifications fail
        }
      })();
    }
  }, [playerName, gameId]);

  useEffect(() => {
    if (!playerName || !gameId) {
      notifiedMatches.current.clear();
      return;
    }

    const prefs = getNotificationPreferences(gameId);
    if (!prefs.enabled) return;

    // Get player's upcoming matches
    const playerMatches = matches.filter((match) => {
      const allPlayers = [...match.team1, ...match.team2];
      return allPlayers.includes(playerName) && !matchScores.has(match.id);
    });

    if (playerMatches.length === 0) return;

    // Find current match (if playing now)
    const currentMatch = playerMatches.find((match) => {
      const matchesOnCourt = matches.filter((m) => m.court === match.court);
      const currentIndex = matchesOnCourt.findIndex((m) => !matchScores.has(m.id));
      return currentIndex >= 0 && matchesOnCourt[currentIndex].id === match.id;
    });

    // Find matches ahead
    const matchesAhead = playerMatches.filter((match) => !currentMatch || match.id !== currentMatch.id);

    // Notify for current match starting
    if (currentMatch && !notifiedMatches.current.has(`starting_${currentMatch.id}`)) {
      if (prefs.matchStarting) {
        showNotification(
          "Your match is starting! 🎾",
          `Court ${currentMatch.court} - Get ready to play!`
        );
        toast({
          title: "Your match is starting! 🎾",
          description: `Court ${currentMatch.court} - Get ready to play!`,
          duration: 8000,
        });
        notifiedMatches.current.add(`starting_${currentMatch.id}`);
      }
    }

    // Notify when on deck (1 match ahead)
    if (matchesAhead.length >= 1 && !notifiedMatches.current.has(`ondeck_${matchesAhead[0].id}`)) {
      if (prefs.onDeck) {
        showNotification("You're on deck! 🏓", "You're up next. Get ready!");
        toast({
          title: "You're on deck! 🏓",
          description: "You're up next. Get ready!",
        });
        notifiedMatches.current.add(`ondeck_${matchesAhead[0].id}`);
      }
    }

    // Notify when 2 matches ahead
    if (matchesAhead.length >= 2 && !notifiedMatches.current.has(`two_ahead_${matchesAhead[1].id}`)) {
      if (prefs.twoMatchesAhead) {
        showNotification("Coming up soon", "You're up in 2 matches");
        notifiedMatches.current.add(`two_ahead_${matchesAhead[1].id}`);
      }
    }
  }, [matches, playerName, gameId, matchScores]);

  const showNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  };
};
