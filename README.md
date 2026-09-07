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
- ⚡ **Offline-First & Auto-Sync**:
  - If you log a workout in a basement or garage with poor or no internet connection, it is automatically queued in local storage.
  - Workouts recorded offline are immediately visible in your Recent list and Stats with a *"Pending Sync"* badge.
  - As soon as your phone reconnects to Wi-Fi/cellular, the app automatically syncs all queued rides to Supabase.
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
   - An index on `date DESC` for query performance.
   - Row Level Security (RLS) policies allowing read and insert operations with the public anonymous API key.

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

## Local Development & Preview

Because this project uses vanilla HTML, CSS, and JS with Supabase loaded via CDN, there are no dependencies to install and no build tools required:

```powershell
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
   git commit -m "Build mobile-first stationary bike workout tracker"
   git push origin main
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

Table: `workouts`

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
