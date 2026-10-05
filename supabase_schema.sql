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

-- ==============================================================================
-- Circadian Sleep Coaching Schema
-- ==============================================================================

-- 6. User Circadian Profile & Anchor Settings
CREATE TABLE IF NOT EXISTS public.sleep_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anchor_wake_time TIME NOT NULL DEFAULT '07:00:00',
    target_bedtime TIME NOT NULL DEFAULT '23:30:00',
    caffeine_cutoff_time TIME NOT NULL DEFAULT '14:00:00',
    consecutive_success_days INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_success_days >= 0),
    total_shifts_applied INTEGER NOT NULL DEFAULT 0 CHECK (total_shifts_applied >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sleep_profiles IS 'User circadian anchor settings and rolling progress';
ALTER TABLE public.sleep_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on sleep_profiles"
ON public.sleep_profiles FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert access on sleep_profiles"
ON public.sleep_profiles FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update access on sleep_profiles"
ON public.sleep_profiles FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous delete access on sleep_profiles"
ON public.sleep_profiles FOR DELETE TO anon USING (true);

-- 7. Daily Circadian Cue Checklist Tracking
CREATE TABLE IF NOT EXISTS public.circadian_habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE NOT NULL UNIQUE,
    morning_light_done BOOLEAN NOT NULL DEFAULT false,
    caffeine_cutoff_done BOOLEAN NOT NULL DEFAULT false,
    light_dimming_done BOOLEAN NOT NULL DEFAULT false,
    temp_drop_done BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.circadian_habit_logs IS 'Daily circadian behavioral cue logs';
CREATE INDEX IF NOT EXISTS idx_circadian_habits_date_desc ON public.circadian_habit_logs (log_date DESC);
ALTER TABLE public.circadian_habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on circadian_habit_logs"
ON public.circadian_habit_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert access on circadian_habit_logs"
ON public.circadian_habit_logs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update access on circadian_habit_logs"
ON public.circadian_habit_logs FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous delete access on circadian_habit_logs"
ON public.circadian_habit_logs FOR DELETE TO anon USING (true);

-- 8. Sleep Logs for Shift-and-Expand Sleep Consolidation Tracking
CREATE TABLE IF NOT EXISTS public.sleep_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sleep_date DATE NOT NULL UNIQUE,
    bedtime TIME NOT NULL,
    wake_time TIME NOT NULL,
    latency_minutes INTEGER NOT NULL CHECK (latency_minutes >= 0),
    fell_asleep_under_20min BOOLEAN NOT NULL DEFAULT true,
    slept_through BOOLEAN NOT NULL DEFAULT true,
    early_awakening BOOLEAN NOT NULL DEFAULT false,
    night_interruptions INTEGER NOT NULL DEFAULT 0 CHECK (night_interruptions >= 0),
    notes TEXT,
    target_bedtime_snapshot TIME NOT NULL,
    anchor_wake_snapshot TIME NOT NULL,
    is_consolidated_success BOOLEAN NOT NULL DEFAULT false,
    shift_awarded BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sleep_logs IS 'Nightly sleep session logs for circadian shift evaluation';
CREATE INDEX IF NOT EXISTS idx_sleep_logs_date_desc ON public.sleep_logs (sleep_date DESC);
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on sleep_logs"
ON public.sleep_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert access on sleep_logs"
ON public.sleep_logs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update access on sleep_logs"
ON public.sleep_logs FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous delete access on sleep_logs"
ON public.sleep_logs FOR DELETE TO anon USING (true);

