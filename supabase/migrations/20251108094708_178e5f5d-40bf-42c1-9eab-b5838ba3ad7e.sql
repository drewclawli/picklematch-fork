-- Enable full row data capture for realtime updates
ALTER TABLE public.games REPLICA IDENTITY FULL;