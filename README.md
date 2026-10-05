# Stationary Bike Workout Tracker (VeloLog)

A lightweight, mobile-first web application designed specifically for recording and analyzing personal stationary bike workouts on a smartphone.

Built with vanilla **HTML5**, **CSS3**, and **JavaScript**, backed by **Supabase (PostgreSQL)**, and architected for 100% static hosting on GitHub Pages with a custom domain.

---

## Key Features

- 📱 **Mobile-First UX**: Optimized for mobile screens with a fixed bottom tab bar, touch-friendly inputs (min 44px), and native safe-area support (`env(safe-area-inset-bottom)`).
- 🚴 **Tab 1: Record Workout**:
  - Exercise Type dropdown (defaults to `stationary_bicycle`).
  - Inputs for Distance (km), Duration (minutes), and Calories Burned.
  - Interactive range sliders for **Bike Program** (1–10) and **Bike Load** (1–10) with live value badges and `+`/`−` micro-step buttons.
  - Form validation with clear visual feedback.
- 📊 **Tab 2: Stats & Analytics**:
  - Segmented toggle to switch between **This Month** and **All-Time** statistics.
  - **Totals**: Total Duration (formatted as hours and minutes, e.g. `8h 35m`), Total Distance (km), Total Calories, and Total Rides.
  - **Averages**: Average Duration, Average Distance, Average Calories, Average Bike Program Level, and Average Bike Load Level.
- 🕒 **Tab 3: Recent Workouts**:
  - Displays the last 10 workout sessions in clean chronological cards.
  - Relative dates ("Today", "Yesterday", or formatted dates), key metrics, and program/load chips.
- 🌙 **Tab 4: Circadian Sleep Coaching**:
  - **The Shift-and-Expand Algorithm**: Anchor wake time circadian locking with rolling 15-minute bedtime shifts awarded after 3 consecutive consolidated nights (latency <= 20 min, no interruptions, no premature awakenings). If premature awakenings occur, bedtime remains steady to consolidate sleep pressure.
  - **Daily Circadian Cue Checklist**: Real-time behavioral cue tracking (Morning daylight 15–20m, Caffeine cut-off by 2:00 PM, Light dimming 90m pre-bed, Core temperature drop warm bath/shower 60–90m pre-bed).
  - **Clinical Protocols**: Interactive 20-minute rule guide for nighttime awakenings (low-stimulus engagement, non-stimulating UI, zero time cues) and delayed morning light warning on early awakenings to prevent SCN phase-advances.
- ⚡ **Offline-First & Auto-Sync**:
  - If you log a workout or sleep session in a basement or garage with poor or no internet connection, it is automatically queued in local storage.
  - Workouts and sleep data recorded offline are immediately visible with local persistence.
  - As soon as your phone reconnects to Wi-Fi/cellular, the app automatically syncs all queued records to Supabase.
- ⚙️ **Zero Build Step & Client Config**:
  - Run directly in any browser.
  - Credentials can be configured in `public/js/app.js` or directly entered in the in-app Settings (⚙️) modal.

---

## Quick Setup Guide

### 1. Set Up Supabase Database

1. Sign in to your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project (or use an existing one).
2. Go to the **SQL Editor** tab from the left sidebar.
3. Open or copy the contents of [`supabase_schema.sql`](./supabase_schema.sql) from this repository.
4. Click **Run**. This creates:
   - The `workouts` table with all fields and check constraints (1 to 10 scale for program and load).
   - The `sleep_profiles`, `sleep_logs`, and `circadian_habit_logs` tables.
   - Indices for fast chronological queries.
   - Row Level Security (RLS) policies allowing read, insert, and update operations with the public anonymous API key.

### 2. Configure Credentials

You have two simple ways to connect the app to your Supabase project:

#### Option A: In-App Settings (No Code Edit Needed)
1. Open the website in your mobile browser or desktop.
2. Tap the **⚙️ (Settings)** icon in the top header.
3. Paste your **Project URL** and **Anon Key** (found in Supabase under `Project Settings -> API`).
4. Tap **Save & Connect**. The credentials will be saved in your browser’s `localStorage`.

#### Option B: In Code (`public/js/app.js`)
Edit lines 10-11 in [`public/js/app.js`](./public/js/app.js):
```javascript
const DEFAULT_SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsIn...';
```

---

## Local Development & Testing

Because this project uses vanilla HTML, CSS, and JS with Supabase loaded via CDN, there are no dependencies to install and no build tools required:

```powershell
# Run the automated test suite for the Circadian Sleep Coaching algorithm
node test/circadian-sleep.test.js

# Preview with any lightweight static server (e.g., npx serve)
npx serve .

# Or with Python
python -m http.server 8000
```
Open `http://localhost:3000` (or `http://localhost:8000`) in your browser or mobile emulator.

---

## Deploying to GitHub Pages with a Custom Domain

1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Add Circadian Sleep Coaching module and Shift-and-Expand algorithm"
   git push origin feature/circadian-sleep-coaching
   ```
2. Go to your repository on GitHub:
   - Navigate to **Settings** -> **Pages**.
   - Under **Build and deployment** -> **Source**, select `Deploy from a branch`.
   - Select `main` branch and `/ (root)` folder, then click **Save**.
3. To configure your custom domain:
   - Under **Custom domain**, enter your domain name (e.g. `bike.example.com` or `yourdomain.com`).
   - Add the corresponding `CNAME` or `A` DNS records at your domain registrar pointing to GitHub Pages.
   - Check **Enforce HTTPS**.

---

## Database Schema Reference

### Table: `workouts`

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key (`gen_random_uuid()`) |
| `date` | `TIMESTAMPTZ` | Timestamp of workout (`default now()`) |
| `exercise_type` | `TEXT` | Exercise type (`stationary_bicycle`) |
| `distance_km` | `NUMERIC(6,2)` | Distance covered in kilometers |
| `duration_minutes`| `INTEGER` | Session duration in minutes |
| `calories_burned` | `INTEGER` | Calories burned (kcal) |
| `bike_program_level` | `INTEGER` | Bike program setting (1–10) |
| `bike_load_level` | `INTEGER` | Bike resistance/load setting (1–10) |
| `created_at` | `TIMESTAMPTZ` | Record creation timestamp |

### Table: `sleep_profiles`

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `anchor_wake_time` | `TIME` | Fixed non-negotiable anchor wake time (default `07:00`) |
| `target_bedtime` | `TIME` | Current recommended target bedtime (default `23:30`) |
| `caffeine_cutoff_time` | `TIME` | Configured caffeine cessation time (default `14:00`) |
| `consecutive_success_days` | `INTEGER` | Trailing consolidated nights toward next shift (0 to 3) |
| `total_shifts_applied` | `INTEGER` | Cumulative 15-minute expansions achieved |
| `updated_at` | `TIMESTAMPTZ` | Timestamp of last profile update |

### Table: `sleep_logs`

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `sleep_date` | `DATE` | Unique night date (YYYY-MM-DD) |
| `bedtime` | `TIME` | Bedtime recorded |
| `wake_time` | `TIME` | Wake time recorded |
| `latency_minutes` | `INTEGER` | Time taken to fall asleep (minutes) |
| `fell_asleep_under_20min`| `BOOLEAN` | True if latency <= 20 minutes |
| `slept_through` | `BOOLEAN` | True if no disruptive awakenings (> 20 min) |
| `early_awakening` | `BOOLEAN` | True if awoke prematurely prior to anchor time |
| `night_interruptions` | `INTEGER` | Count of nighttime awakenings |
| `is_consolidated_success` | `BOOLEAN` | Night met all consolidation criteria |
| `shift_awarded` | `BOOLEAN` | True if this log triggered a 15-minute shift |

### Table: `circadian_habit_logs`

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `log_date` | `DATE` | Habit date (YYYY-MM-DD) |
| `morning_light_done` | `BOOLEAN` | 15–20m natural daylight within 30m of wake |
| `caffeine_cutoff_done`| `BOOLEAN` | Caffeine ceased by cut-off time |
| `light_dimming_done` | `BOOLEAN` | Overhead lights dimmed 90m before target bedtime |
| `temp_drop_done` | `BOOLEAN` | Warm bath/shower 60–90m before bedtime |
