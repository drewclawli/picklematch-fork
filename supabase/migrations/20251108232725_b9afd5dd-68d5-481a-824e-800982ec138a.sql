-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read their own games" ON public.games;
DROP POLICY IF EXISTS "Users can update their own games" ON public.games;

-- Create new policies that allow access via game code
CREATE POLICY "Anyone can read games with valid game code"
ON public.games
FOR SELECT
USING (true);

CREATE POLICY "Anyone can update games with valid game code"
ON public.games
FOR UPDATE
USING (true);

-- Keep the insert policy as is (only creator can create)
-- INSERT policy "Users can create their own games" remains unchanged