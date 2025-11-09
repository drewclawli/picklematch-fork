-- Create enum for player status
CREATE TYPE public.player_status AS ENUM ('active', 'sitting_out', 'left_game');

-- Player devices and status tracking table
CREATE TABLE public.player_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  player_name TEXT NOT NULL,
  device_id TEXT NOT NULL,
  status public.player_status DEFAULT 'active' NOT NULL,
  skip_next_match BOOLEAN DEFAULT false,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notification_preferences JSONB DEFAULT '{"enabled": true, "twoMatchesAhead": true, "onDeck": true, "matchStarting": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_player_devices_game_player ON public.player_devices(game_id, player_name);
CREATE INDEX idx_player_devices_device ON public.player_devices(device_id);
CREATE INDEX idx_player_devices_game_active ON public.player_devices(game_id, status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.player_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read player devices"
  ON public.player_devices FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert player devices"
  ON public.player_devices FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update player devices"
  ON public.player_devices FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete player devices"
  ON public.player_devices FOR DELETE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_player_devices_updated_at
  BEFORE UPDATE ON public.player_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();