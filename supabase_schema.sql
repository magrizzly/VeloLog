-- ==============================================================================
-- Stationary Bike Workout Tracker - Supabase Database Schema
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- ==============================================================================

-- 1. Create the workouts table matching the required specification
CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    exercise_type TEXT NOT NULL DEFAULT 'stationary_bicycle',
    distance_km NUMERIC(6, 2) NOT NULL CHECK (distance_km >= 0),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    calories_burned INTEGER NOT NULL CHECK (calories_burned >= 0),
    bike_program_level INTEGER NOT NULL CHECK (bike_program_level BETWEEN 1 AND 10),
    bike_load_level INTEGER NOT NULL CHECK (bike_load_level BETWEEN 1 AND 10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add comment for documentation
COMMENT ON TABLE public.workouts IS 'Personal stationary bike workouts log';

-- 3. Create index on date descending for fast chronological queries (Recent & Stats)
CREATE INDEX IF NOT EXISTS idx_workouts_date_desc ON public.workouts (date DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Personal Single-User / Public Anon Access:
-- Allows reading workouts with the anon public API key
CREATE POLICY "Allow anonymous read access"
ON public.workouts
FOR SELECT
TO anon
USING (true);

-- Allows inserting new workouts with the anon public API key
CREATE POLICY "Allow anonymous insert access"
ON public.workouts
FOR INSERT
TO anon
WITH CHECK (true);

-- Optional: Allow updating workouts if editing is added in the future
CREATE POLICY "Allow anonymous update access"
ON public.workouts
FOR UPDATE
TO anon
USING (true);

-- Optional: Allow deleting workouts
CREATE POLICY "Allow anonymous delete access"
ON public.workouts
FOR DELETE
TO anon
USING (true);
