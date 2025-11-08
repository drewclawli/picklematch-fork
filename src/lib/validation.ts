import { z } from 'zod';

// Player name validation schema
export const playerNameSchema = z.string()
  .trim()
  .min(1, "Player name is required")
  .max(50, "Player name must be 50 characters or less")
  .regex(/^[a-zA-Z0-9\s\-'\.]+$/, "Player name can only contain letters, numbers, spaces, hyphens, apostrophes, and periods");

// Game code validation schema  
export const gameCodeSchema = z.string()
  .trim()
  .length(6, "Game code must be exactly 6 characters")
  .regex(/^[A-Z0-9]+$/, "Game code must contain only uppercase letters and numbers");

// Match score validation schema
export const matchScoreSchema = z.number()
  .int("Score must be a whole number")
  .min(0, "Score cannot be negative")
  .max(99, "Score must be 99 or less");

// Validate player name with detailed error message
export const validatePlayerName = (name: string): { valid: boolean; error?: string } => {
  try {
    playerNameSchema.parse(name);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0].message };
    }
    return { valid: false, error: "Invalid player name" };
  }
};

// Validate game code with detailed error message
export const validateGameCode = (code: string): { valid: boolean; error?: string } => {
  try {
    gameCodeSchema.parse(code);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0].message };
    }
    return { valid: false, error: "Invalid game code" };
  }
};

// Validate match score with detailed error message
export const validateMatchScore = (score: number | string): { valid: boolean; error?: string; value?: number } => {
  const numScore = typeof score === 'string' ? Number(score) : score;
  
  if (isNaN(numScore)) {
    return { valid: false, error: "Score must be a valid number" };
  }
  
  try {
    matchScoreSchema.parse(numScore);
    return { valid: true, value: numScore };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0].message };
    }
    return { valid: false, error: "Invalid score" };
  }
};
