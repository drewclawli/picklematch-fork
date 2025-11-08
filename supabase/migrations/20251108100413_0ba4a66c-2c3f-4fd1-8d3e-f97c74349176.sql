-- Fix search_path for generate_game_code function to prevent mutable search path warning
CREATE OR REPLACE FUNCTION public.generate_game_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Add database constraints for player names in games table
-- Note: This adds a validation trigger since CHECK constraints must be immutable
CREATE OR REPLACE FUNCTION public.validate_player_names()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Check that all player names are within length limits
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.players) AS player_name
    WHERE length(player_name) > 50 OR length(player_name) < 1
  ) THEN
    RAISE EXCEPTION 'Player names must be between 1 and 50 characters';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate player names on insert/update
DROP TRIGGER IF EXISTS validate_player_names_trigger ON public.games;
CREATE TRIGGER validate_player_names_trigger
  BEFORE INSERT OR UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_player_names();