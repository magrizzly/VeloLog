/**
 * VeloLog - Circadian Sleep Coaching Module
 * Shift-and-Expand Sleep Consolidation Engine, Daily Circadian Cue Checklist,
 * and Clinical Nighttime/Early-Awakening Protocols.
 */

// ============================================================================
// 1. Constants, Keys & Defaults
// ============================================================================
const SLEEP_STORAGE_KEYS = {
  PROFILE: 'velolog_circadian_sleep_profile',
  LOGS: 'velolog_circadian_sleep_logs',
  HABITS: 'velolog_circadian_habit_logs',
  SYNC_QUEUE: 'velolog_circadian_sync_queue'
};

const DEFAULT_CIRCADIAN_PROFILE = {
  anchor_wake_time: '07:00',
  target_bedtime: '23:30',
  caffeine_cutoff_time: '14:00',
  consecutive_success_days: 0,
  total_shifts_applied: 0
};

// ============================================================================
// 2. Pure Time & Circadian Arithmetic Helpers
// ============================================================================

/**
 * Shifts a "HH:MM" time string by deltaMinutes with circular 24h wrap.
 * Example: shiftTimeMinutes("00:05", -15) => "23:50"
 * Example: shiftTimeMinutes("23:30", -15) => "23:15"
 */
function shiftTimeMinutes(timeStr, deltaMinutes) {
  if (!timeStr || !timeStr.includes(':')) return '23:30';
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;

  let totalMin = h * 60 + m + deltaMinutes;
  // Circular modulo 1440
  totalMin = ((totalMin % 1440) + 1440) % 1440;

  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Calculates absolute minute difference from time1 to time2.
 */
function getMinuteDifference(time1, time2) {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;
  return diff;
}

/**
 * Formats "HH:MM" or "HH:MM:SS" into clean 12-hour AM/PM string.
 * Example: "07:00" => "7:00 AM", "23:30" => "11:30 PM"
 */
function formatTime12Hour(timeStr) {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = String(mStr || '00').substring(0, 2);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.padStart(2, '0')} ${ampm}`;
}

/**
 * Formats a Date object or ISO string to YYYY-MM-DD.
 */
function toDateKey(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// 3. The Shift-and-Expand Business Logic Engine
// ============================================================================

/**
 * Determines whether a single sleep session satisfies consolidation criteria:
 * 1. Fell asleep within 20 minutes (latency <= 20).
 * 2. Slept through without disruptive awakenings.
 * 3. No early awakening before anchor wake time.
 */
function evaluateSingleNightSuccess(log) {
  const under20 = log.fell_asleep_under_20min === true || (Number(log.latency_minutes) <= 20);
  const through = log.slept_through === true && (Number(log.night_interruptions || 0) <= 1);
  const notEarly = !log.early_awakening;
  return under20 && through && notEarly;
}

/**
 * Evaluates sleep logs to determine rolling 3-day consecutive success
 * and trigger 15-minute bedtime shifts.
 *
 * Rules:
 * - If user logs 3 consecutive successful nights:
 *     => Shift recommended bedtime 15 minutes EARLIER (expand sleep opportunity).
 *     => Reset consecutive counter to 0 for next 3-night cycle.
 * - If user experiences an early awakening:
 *     => Target bedtime MUST remain STEADY (do not shift earlier).
 *     => Consecutive streak resets to 0 until sleep consolidates.
 * - If latency > 20 min or interrupted sleep:
 *     => Bedtime remains steady.
 *     => Streak resets to 0.
 */
function evaluateShiftAndExpand(logs, currentProfile) {
  const profile = { ...currentProfile };
  if (!logs || !logs.length) {
    return {
      profile,
      latestNightSuccess: null,
      shiftTriggered: false,
      consecutiveSuccessDays: profile.consecutive_success_days || 0,
      earlyAwakeningDetected: false,
      message: 'No sleep records logged yet.'
    };
  }

  // Sort logs chronologically ascending
  const sorted = [...logs].sort((a, b) => (a.sleep_date > b.sleep_date ? 1 : -1));
  const latestLog = sorted[sorted.length - 1];

  const isLatestSuccess = evaluateSingleNightSuccess(latestLog);
  const isEarly = latestLog.early_awakening === true;

  let currentStreak = profile.consecutive_success_days || 0;
  let shiftTriggered = false;
  let previousBedtime = profile.target_bedtime;
  let newBedtime = profile.target_bedtime;
  let message = '';

  if (isEarly) {
    // Premature awakening detected: hold bedtime steady, streak resets
    currentStreak = 0;
    message = `Early awakening logged. Target bedtime kept steady at ${formatTime12Hour(profile.target_bedtime)} to consolidate sleep pressure.`;
  } else if (!isLatestSuccess) {
    // Latency > 20 min or night interruption: hold bedtime steady, reset streak
    currentStreak = 0;
    message = `Sleep was not consolidated last night. Target bedtime held steady at ${formatTime12Hour(profile.target_bedtime)}.`;
  } else {
    // Successful night!
    currentStreak += 1;
    if (currentStreak >= 3) {
      // 3 consecutive consolidated nights: SHIFT 15 MINUTES EARLIER
      newBedtime = shiftTimeMinutes(profile.target_bedtime, -15);
      profile.target_bedtime = newBedtime;
      profile.total_shifts_applied = (profile.total_shifts_applied || 0) + 1;
      currentStreak = 0; // Reset streak towards next 3-day milestone
      shiftTriggered = true;
      message = `🎉 3 consecutive consolidated nights achieved! Bedtime shifted 15 minutes earlier from ${formatTime12Hour(previousBedtime)} to ${formatTime12Hour(newBedtime)}.`;
    } else {
      message = `Consolidated night logged! Streak: ${currentStreak}/3 nights to next 15-minute bedtime expansion.`;
    }
  }

  profile.consecutive_success_days = currentStreak;

  return {
    profile,
    latestNightSuccess: isLatestSuccess,
    shiftTriggered,
    previousBedtime,
    newBedtime,
    consecutiveSuccessDays: currentStreak,
    earlyAwakeningDetected: isEarly,
    message
  };
}

/**
 * Calculates dynamic circadian cue times based on anchor wake time and target bedtime.
 */
function calculateCircadianCueWindows(anchorWakeTime, targetBedtime, caffeineCutoff = '14:00') {
  // 1. Morning Light: within 20-30 min of wake time
  const morningLightStart = anchorWakeTime;
  const morningLightEnd = shiftTimeMinutes(anchorWakeTime, 30);

  // 2. Caffeine Cut-off: defaults to 1:00 PM or 2:00 PM
  const caffeineCutoffTime = caffeineCutoff || '14:00';

  // 3. Light Dimming: 90 minutes prior to target bedtime
  const lightDimmingTime = shiftTimeMinutes(targetBedtime, -90);

  // 4. Core Temp Drop (Warm Bath/Shower): 60 to 90 minutes before bedtime
  const tempDropStart = shiftTimeMinutes(targetBedtime, -90);
  const tempDropEnd = shiftTimeMinutes(targetBedtime, -60);

  return {
    morningLight: {
      start: morningLightStart,
      end: morningLightEnd,
      label: `${formatTime12Hour(morningLightStart)} – ${formatTime12Hour(morningLightEnd)}`,
      desc: '15–20 min natural daylight within 30 min of waking to lock the circadian phase.'
    },
    caffeineCutoff: {
      time: caffeineCutoffTime,
      label: `By ${formatTime12Hour(caffeineCutoffTime)}`,
      desc: 'Cease all caffeine intake 8–10 hours before bed to allow adenosine clearance.'
    },
    lightDimming: {
      time: lightDimmingTime,
      label: `At ${formatTime12Hour(lightDimmingTime)} (90m pre-bed)`,
      desc: 'Aggressively dim overhead lights & activate night filters to release melatonin.'
    },
    tempDrop: {
      start: tempDropStart,
      end: tempDropEnd,
      label: `${formatTime12Hour(tempDropStart)} – ${formatTime12Hour(tempDropEnd)}`,
      desc: 'Warm bath or shower 60–90 min before bed to trigger vasodilation and drop core temp.'
    }
  };
}

// ============================================================================
// 4. Local Persistence & Offline Sync
// ============================================================================

function getSleepProfile() {
  try {
    const raw = localStorage.getItem(SLEEP_STORAGE_KEYS.PROFILE);
    if (!raw) return { ...DEFAULT_CIRCADIAN_PROFILE };
    return { ...DEFAULT_CIRCADIAN_PROFILE, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Error reading sleep profile:', e);
    return { ...DEFAULT_CIRCADIAN_PROFILE };
  }
}

function saveSleepProfile(profile) {
  try {
    localStorage.setItem(SLEEP_STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    enqueueSleepSync('profile', profile);
  } catch (e) {
    console.error('Error saving sleep profile:', e);
  }
}

function getSleepLogs() {
  try {
    const raw = localStorage.getItem(SLEEP_STORAGE_KEYS.LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading sleep logs:', e);
    return [];
  }
}

function saveSleepLogs(logs) {
  try {
    localStorage.setItem(SLEEP_STORAGE_KEYS.LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Error saving sleep logs:', e);
  }
}

function getCircadianHabitLogs() {
  try {
    const raw = localStorage.getItem(SLEEP_STORAGE_KEYS.HABITS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Error reading habit logs:', e);
    return {};
  }
}

function saveCircadianHabitLogs(habits) {
  try {
    localStorage.setItem(SLEEP_STORAGE_KEYS.HABITS, JSON.stringify(habits));
  } catch (e) {
    console.error('Error saving habit logs:', e);
  }
}

function enqueueSleepSync(type, payload) {
  try {
    const queue = JSON.parse(localStorage.getItem(SLEEP_STORAGE_KEYS.SYNC_QUEUE) || '[]');
    queue.push({
      type,
      payload,
      id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(SLEEP_STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    triggerSleepSync();
  } catch (e) {
    console.error('Error enqueuing sleep sync:', e);
  }
}

/**
 * Attempts to sync queued sleep records to Supabase when connected.
 */
async function triggerSleepSync() {
  if (!navigator.onLine) return;
  const client = window.supabaseClient;
  if (!client || typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured()) return;
  if (typeof currentConnectionState !== 'undefined' && currentConnectionState === 'paused') return;

  let queue = [];
  try {
    queue = JSON.parse(localStorage.getItem(SLEEP_STORAGE_KEYS.SYNC_QUEUE) || '[]');
  } catch (e) {
    return;
  }
  if (!queue.length) return;

  const remaining = [];
  for (const item of queue) {
    try {
      if (item.type === 'profile') {
        const { error } = await client.from('sleep_profiles').upsert([item.payload]);
        if (error) remaining.push(item);
      } else if (item.type === 'sleep_log') {
        const { error } = await client.from('sleep_logs').upsert([item.payload]);
        if (error) remaining.push(item);
      } else if (item.type === 'habit_log') {
        const { error } = await client.from('circadian_habit_logs').upsert([item.payload]);
        if (error) remaining.push(item);
      }
    } catch (err) {
      remaining.push(item);
    }
  }

  localStorage.setItem(SLEEP_STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(remaining));
}

// ============================================================================
// 5. UI Controller & View Binding
// ============================================================================

let currentSelectedHabitDate = toDateKey();

function initSleepModule() {
  renderSleepDashboard();
  bindSleepEvents();
  triggerSleepSync();
}

/**
 * Full render of the Sleep Dashboard tab pane.
 */
function renderSleepDashboard() {
  const profile = getSleepProfile();
  const logs = getSleepLogs();
  const cueWindows = calculateCircadianCueWindows(
    profile.anchor_wake_time,
    profile.target_bedtime,
    profile.caffeine_cutoff_time
  );

  // Update Hero Metric Cards
  const anchorTimeEl = document.getElementById('val-anchor-wake');
  const targetBedEl = document.getElementById('val-target-bedtime');
  const streakCountEl = document.getElementById('val-streak-count');
  const streakFillEl = document.getElementById('streak-progress-fill');
  const streakTextEl = document.getElementById('val-streak-status');
  const shiftsCountEl = document.getElementById('val-shifts-applied');

  if (anchorTimeEl) anchorTimeEl.textContent = formatTime12Hour(profile.anchor_wake_time);
  if (targetBedEl) targetBedEl.textContent = formatTime12Hour(profile.target_bedtime);
  if (streakCountEl) streakCountEl.textContent = `${profile.consecutive_success_days || 0} / 3`;
  if (shiftsCountEl) shiftsCountEl.textContent = `${profile.total_shifts_applied || 0} shifts`;

  const streakPct = Math.min(100, Math.round(((profile.consecutive_success_days || 0) / 3) * 100));
  if (streakFillEl) streakFillEl.style.width = `${streakPct}%`;

  if (streakTextEl) {
    if ((profile.consecutive_success_days || 0) === 0) {
      streakTextEl.textContent = 'Steady Target: Consolidating sleep pressure';
    } else if (profile.consecutive_success_days === 1) {
      streakTextEl.textContent = '1 of 3 consolidated nights logged';
    } else if (profile.consecutive_success_days === 2) {
      streakTextEl.textContent = '2 of 3 nights: 1 more night to 15m shift!';
    } else {
      streakTextEl.textContent = 'Consolidated & ready to expand';
    }
  }

  // Update dynamic time labels on Cue Checklist
  renderCircadianCues(cueWindows);

  // Check for Early Awakening Alert on the most recent log
  renderEarlyAwakeningAlert(logs, profile);

  // Render Recent Sleep Logs list
  renderRecentSleepLogs(logs);
}

/**
 * Renders the daily habit cue checklist for currentSelectedHabitDate.
 */
function renderCircadianCues(cueWindows) {
  const habits = getCircadianHabitLogs();
  const dayHabits = habits[currentSelectedHabitDate] || {
    morning_light: false,
    caffeine_cutoff: false,
    light_dimming: false,
    temp_drop: false
  };

  // Time labels
  const morningLabel = document.getElementById('cue-time-morning-light');
  const caffeineLabel = document.getElementById('cue-time-caffeine');
  const dimmingLabel = document.getElementById('cue-time-dimming');
  const tempDropLabel = document.getElementById('cue-time-temp-drop');

  if (morningLabel) morningLabel.textContent = cueWindows.morningLight.label;
  if (caffeineLabel) caffeineLabel.textContent = cueWindows.caffeineCutoff.label;
  if (dimmingLabel) dimmingLabel.textContent = cueWindows.lightDimming.label;
  if (tempDropLabel) tempDropLabel.textContent = cueWindows.tempDrop.label;

  // Checkbox inputs
  const cbMorning = document.getElementById('cb-cue-morning-light');
  const cbCaffeine = document.getElementById('cb-cue-caffeine');
  const cbDimming = document.getElementById('cb-cue-dimming');
  const cbTempDrop = document.getElementById('cb-cue-temp-drop');

  if (cbMorning) cbMorning.checked = !!dayHabits.morning_light;
  if (cbCaffeine) cbCaffeine.checked = !!dayHabits.caffeine_cutoff;
  if (cbDimming) cbDimming.checked = !!dayHabits.light_dimming;
  if (cbTempDrop) cbTempDrop.checked = !!dayHabits.temp_drop;

  // Active state styling on cards
  updateCueCardStyle('card-cue-morning-light', !!dayHabits.morning_light);
  updateCueCardStyle('card-cue-caffeine', !!dayHabits.caffeine_cutoff);
  updateCueCardStyle('card-cue-dimming', !!dayHabits.light_dimming);
  updateCueCardStyle('card-cue-temp-drop', !!dayHabits.temp_drop);

  // Completed count badge
  const completedCount = [
    dayHabits.morning_light,
    dayHabits.caffeine_cutoff,
    dayHabits.light_dimming,
    dayHabits.temp_drop
  ].filter(Boolean).length;

  const countBadge = document.getElementById('cue-completion-badge');
  const cueProgressFill = document.getElementById('cue-progress-fill');
  if (countBadge) countBadge.textContent = `${completedCount} / 4 Completed`;
  if (cueProgressFill) cueProgressFill.style.width = `${(completedCount / 4) * 100}%`;
}

function updateCueCardStyle(cardId, isChecked) {
  const card = document.getElementById(cardId);
  if (!card) return;
  if (isChecked) {
    card.classList.add('cue-done');
  } else {
    card.classList.remove('cue-done');
  }
}

/**
 * Toggles a habit item for currentSelectedHabitDate.
 */
function toggleCircadianHabit(habitKey, checked) {
  const habits = getCircadianHabitLogs();
  if (!habits[currentSelectedHabitDate]) {
    habits[currentSelectedHabitDate] = {
      morning_light: false,
      caffeine_cutoff: false,
      light_dimming: false,
      temp_drop: false
    };
  }
  habits[currentSelectedHabitDate][habitKey] = checked;
  saveCircadianHabitLogs(habits);

  const profile = getSleepProfile();
  const cueWindows = calculateCircadianCueWindows(
    profile.anchor_wake_time,
    profile.target_bedtime,
    profile.caffeine_cutoff_time
  );
  renderCircadianCues(cueWindows);

  // Enqueue sync record
  enqueueSleepSync('habit_log', {
    log_date: currentSelectedHabitDate,
    morning_light_done: habits[currentSelectedHabitDate].morning_light,
    caffeine_cutoff_done: habits[currentSelectedHabitDate].caffeine_cutoff,
    light_dimming_done: habits[currentSelectedHabitDate].light_dimming,
    temp_drop_done: habits[currentSelectedHabitDate].temp_drop,
    updated_at: new Date().toISOString()
  });

  if (typeof showToast === 'function') {
    showToast(checked ? 'Circadian habit marked complete!' : 'Habit unchecked.', 'info', 2000);
  }
}

/**
 * Checks if the most recent sleep log had an early awakening,
 * and if so renders the clinical warning banner.
 */
function renderEarlyAwakeningAlert(logs, profile) {
  const alertEl = document.getElementById('early-awakening-alert-banner');
  const alertTimeEl = document.getElementById('alert-anchor-time-val');
  if (!alertEl) return;

  if (!logs || !logs.length) {
    alertEl.style.display = 'none';
    return;
  }

  const sorted = [...logs].sort((a, b) => (a.sleep_date > b.sleep_date ? 1 : -1));
  const latest = sorted[sorted.length - 1];

  if (latest && latest.early_awakening === true) {
    alertEl.style.display = 'flex';
    if (alertTimeEl) {
      alertTimeEl.textContent = formatTime12Hour(profile.anchor_wake_time);
    }
  } else {
    alertEl.style.display = 'none';
  }
}

/**
 * Renders the recent sleep logs list.
 */
function renderRecentSleepLogs(logs) {
  const container = document.getElementById('sleep-logs-list');
  if (!container) return;

  if (!logs || !logs.length) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon">🌙</div>
        <h4>No sleep sessions recorded</h4>
        <p>Log your first night's sleep to activate the Shift-and-Expand algorithm.</p>
        <button type="button" class="btn btn-primary" onclick="openLogSleepModal()">Log Last Night</button>
      </div>
    `;
    return;
  }

  const sorted = [...logs].sort((a, b) => (a.sleep_date > b.sleep_date ? -1 : 1));

  container.innerHTML = sorted.slice(0, 10).map(log => {
    const isConsolidated = evaluateSingleNightSuccess(log);
    const dateFormatted = formatLogDate(log.sleep_date);

    return `
      <div class="sleep-history-card ${isConsolidated ? 'consolidated' : 'unconsolidated'}">
        <div class="sleep-card-header">
          <div>
            <span class="sleep-card-date">${escapeHtml(dateFormatted)}</span>
            <span class="sleep-badge ${isConsolidated ? 'badge-success' : 'badge-steady'}">
              ${isConsolidated ? '✓ Consolidated' : 'Steady State'}
            </span>
            ${log.shift_awarded ? '<span class="sleep-badge badge-shift">+15m Shift Awarded</span>' : ''}
          </div>
          <span class="sleep-time-range">${formatTime12Hour(log.bedtime)} → ${formatTime12Hour(log.wake_time)}</span>
        </div>

        <div class="sleep-card-metrics">
          <div class="sleep-metric">
            <span class="sleep-metric-label">Fall Asleep</span>
            <span class="sleep-metric-val ${log.fell_asleep_under_20min ? 'val-good' : 'val-warn'}">
              ${log.latency_minutes}m ${log.fell_asleep_under_20min ? '(≤ 20m)' : '(> 20m)'}
            </span>
          </div>

          <div class="sleep-metric">
            <span class="sleep-metric-label">Slept Through</span>
            <span class="sleep-metric-val ${log.slept_through ? 'val-good' : 'val-warn'}">
              ${log.slept_through ? 'Yes' : `${log.night_interruptions || 1} wakings`}
            </span>
          </div>

          <div class="sleep-metric">
            <span class="sleep-metric-label">Early Awakening</span>
            <span class="sleep-metric-val ${log.early_awakening ? 'val-warn' : 'val-good'}">
              ${log.early_awakening ? 'Yes (Premature)' : 'No (On Anchor)'}
            </span>
          </div>
        </div>

        ${log.early_awakening ? `
          <div class="sleep-card-warning-pill">
            ⚠️ Early wake: Morning light delayed until anchor time. Bedtime remained steady.
          </div>
        ` : ''}

        ${log.notes ? `<div class="sleep-card-notes">"${escapeHtml(log.notes)}"</div>` : ''}
      </div>
    `;
  }).join('');
}

function formatLogDate(dateStr) {
  if (!dateStr) return '';
  const todayStr = toDateKey();
  const yesterdayStr = toDateKey(new Date(Date.now() - 86400000));
  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return dateStr;
}

// ============================================================================
// 6. Modal Controllers & Handlers
// ============================================================================

function openLogSleepModal() {
  const modal = document.getElementById('modal-log-sleep');
  if (!modal) return;

  const profile = getSleepProfile();
  const yesterdayStr = toDateKey(new Date(Date.now() - 86400000));

  const dateInput = document.getElementById('sleep-form-date');
  const bedtimeInput = document.getElementById('sleep-form-bedtime');
  const wakeInput = document.getElementById('sleep-form-wake');
  const latencyInput = document.getElementById('sleep-form-latency');
  const cbUnder20 = document.getElementById('sleep-form-under-20');
  const cbSleptThrough = document.getElementById('sleep-form-slept-through');
  const cbEarlyAwakening = document.getElementById('sleep-form-early');
  const interruptionsRow = document.getElementById('sleep-form-interruptions-row');
  const earlyWarningPreview = document.getElementById('sleep-form-early-preview');

  if (dateInput) dateInput.value = yesterdayStr;
  if (bedtimeInput) bedtimeInput.value = profile.target_bedtime || '23:30';
  if (wakeInput) wakeInput.value = profile.anchor_wake_time || '07:00';
  if (latencyInput) latencyInput.value = '15';
  if (cbUnder20) cbUnder20.checked = true;
  if (cbSleptThrough) cbSleptThrough.checked = true;
  if (cbEarlyAwakening) cbEarlyAwakening.checked = false;
  if (interruptionsRow) interruptionsRow.style.display = 'none';
  if (earlyWarningPreview) earlyWarningPreview.style.display = 'none';

  modal.classList.add('active');
}

function closeLogSleepModal() {
  const modal = document.getElementById('modal-log-sleep');
  if (modal) modal.classList.remove('active');
}

function openAnchorSettingsModal() {
  const modal = document.getElementById('modal-anchor-settings');
  if (!modal) return;

  const profile = getSleepProfile();
  const anchorInput = document.getElementById('cfg-anchor-wake-time');
  const targetBedInput = document.getElementById('cfg-target-bedtime');
  const caffeineInput = document.getElementById('cfg-caffeine-cutoff');

  if (anchorInput) anchorInput.value = profile.anchor_wake_time || '07:00';
  if (targetBedInput) targetBedInput.value = profile.target_bedtime || '23:30';
  if (caffeineInput) caffeineInput.value = profile.caffeine_cutoff_time || '14:00';

  modal.classList.add('active');
}

function closeAnchorSettingsModal() {
  const modal = document.getElementById('modal-anchor-settings');
  if (modal) modal.classList.remove('active');
}

function openNightInterruptionModal() {
  const modal = document.getElementById('modal-night-interruption');
  if (modal) modal.classList.add('active');
}

function closeNightInterruptionModal() {
  const modal = document.getElementById('modal-night-interruption');
  if (modal) modal.classList.remove('active');
}

// ============================================================================
// 7. Form Submissions & Event Listeners
// ============================================================================

function bindSleepEvents() {
  // Modal Open/Close Triggers
  const btnOpenLogSleep = document.getElementById('btn-open-log-sleep');
  const btnCloseLogSleep = document.getElementById('btn-close-log-sleep');
  const btnOpenAnchorCfg = document.getElementById('btn-open-anchor-cfg');
  const btnCloseAnchorCfg = document.getElementById('btn-close-anchor-cfg');
  const btnOpenNightGuide = document.getElementById('btn-open-night-guide');
  const btnCloseNightGuide = document.getElementById('btn-close-night-guide');

  if (btnOpenLogSleep) btnOpenLogSleep.addEventListener('click', openLogSleepModal);
  if (btnCloseLogSleep) btnCloseLogSleep.addEventListener('click', closeLogSleepModal);
  if (btnOpenAnchorCfg) btnOpenAnchorCfg.addEventListener('click', openAnchorSettingsModal);
  if (btnCloseAnchorCfg) btnCloseAnchorCfg.addEventListener('click', closeAnchorSettingsModal);
  if (btnOpenNightGuide) btnOpenNightGuide.addEventListener('click', openNightInterruptionModal);
  if (btnCloseNightGuide) btnCloseNightGuide.addEventListener('click', closeNightInterruptionModal);

  // Close modals on overlay backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Habit Checkbox Listeners
  const cbMorning = document.getElementById('cb-cue-morning-light');
  const cbCaffeine = document.getElementById('cb-cue-caffeine');
  const cbDimming = document.getElementById('cb-cue-dimming');
  const cbTempDrop = document.getElementById('cb-cue-temp-drop');

  if (cbMorning) cbMorning.addEventListener('change', e => toggleCircadianHabit('morning_light', e.target.checked));
  if (cbCaffeine) cbCaffeine.addEventListener('change', e => toggleCircadianHabit('caffeine_cutoff', e.target.checked));
  if (cbDimming) cbDimming.addEventListener('change', e => toggleCircadianHabit('light_dimming', e.target.checked));
  if (cbTempDrop) cbTempDrop.addEventListener('change', e => toggleCircadianHabit('temp_drop', e.target.checked));

  // Dynamic Latency & Early Wake Helpers in Sleep Form
  const latencyInput = document.getElementById('sleep-form-latency');
  const cbUnder20 = document.getElementById('sleep-form-under-20');
  const wakeInput = document.getElementById('sleep-form-wake');
  const cbEarlyAwakening = document.getElementById('sleep-form-early');
  const cbSleptThrough = document.getElementById('sleep-form-slept-through');
  const interruptionsRow = document.getElementById('sleep-form-interruptions-row');
  const earlyWarningPreview = document.getElementById('sleep-form-early-preview');

  if (latencyInput && cbUnder20) {
    latencyInput.addEventListener('input', () => {
      const val = parseInt(latencyInput.value, 10) || 0;
      cbUnder20.checked = val <= 20;
    });
    cbUnder20.addEventListener('change', () => {
      if (cbUnder20.checked && parseInt(latencyInput.value, 10) > 20) {
        latencyInput.value = '15';
      } else if (!cbUnder20.checked && parseInt(latencyInput.value, 10) <= 20) {
        latencyInput.value = '35';
      }
    });
  }

  if (cbSleptThrough && interruptionsRow) {
    cbSleptThrough.addEventListener('change', () => {
      interruptionsRow.style.display = cbSleptThrough.checked ? 'none' : 'block';
    });
  }

  if (wakeInput && cbEarlyAwakening) {
    wakeInput.addEventListener('input', () => {
      const profile = getSleepProfile();
      const diff = getMinuteDifference(profile.anchor_wake_time, wakeInput.value);
      // If waking > 25 minutes prior to anchor wake time
      if (diff < -25) {
        cbEarlyAwakening.checked = true;
        if (earlyWarningPreview) earlyWarningPreview.style.display = 'block';
      } else {
        cbEarlyAwakening.checked = false;
        if (earlyWarningPreview) earlyWarningPreview.style.display = 'none';
      }
    });
    cbEarlyAwakening.addEventListener('change', () => {
      if (earlyWarningPreview) {
        earlyWarningPreview.style.display = cbEarlyAwakening.checked ? 'block' : 'none';
      }
    });
  }

  // Sleep Log Form Submission
  const formSleep = document.getElementById('form-log-sleep');
  if (formSleep) {
    formSleep.addEventListener('submit', e => {
      e.preventDefault();
      handleSleepLogSubmit();
    });
  }

  // Anchor Settings Form Submission
  const formAnchor = document.getElementById('form-anchor-settings');
  if (formAnchor) {
    formAnchor.addEventListener('submit', e => {
      e.preventDefault();
      handleAnchorSettingsSubmit();
    });
  }
}

/**
 * Handles sleep log submission, evaluates Shift-and-Expand rules, updates profile and logs.
 */
function handleSleepLogSubmit() {
  const profile = getSleepProfile();
  const dateVal = document.getElementById('sleep-form-date').value || toDateKey();
  const bedtimeVal = document.getElementById('sleep-form-bedtime').value || profile.target_bedtime;
  const wakeVal = document.getElementById('sleep-form-wake').value || profile.anchor_wake_time;
  const latencyVal = parseInt(document.getElementById('sleep-form-latency').value, 10) || 15;
  const under20Val = document.getElementById('sleep-form-under-20').checked;
  const sleptThroughVal = document.getElementById('sleep-form-slept-through').checked;
  const earlyVal = document.getElementById('sleep-form-early').checked;
  const interruptionsVal = sleptThroughVal ? 0 : (parseInt(document.getElementById('sleep-form-interruptions').value, 10) || 1);
  const notesVal = (document.getElementById('sleep-form-notes').value || '').trim();

  const newLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    sleep_date: dateVal,
    bedtime: bedtimeVal,
    wake_time: wakeVal,
    latency_minutes: latencyVal,
    fell_asleep_under_20min: under20Val,
    slept_through: sleptThroughVal,
    early_awakening: earlyVal,
    night_interruptions: interruptionsVal,
    notes: notesVal,
    target_bedtime_snapshot: profile.target_bedtime,
    anchor_wake_snapshot: profile.anchor_wake_time,
    is_consolidated_success: under20Val && sleptThroughVal && !earlyVal,
    shift_awarded: false,
    created_at: new Date().toISOString()
  };

  const logs = getSleepLogs();
  // Filter out any duplicate log for the same date
  const filtered = logs.filter(l => l.sleep_date !== dateVal);
  filtered.push(newLog);

  // Evaluate the Shift-and-Expand Algorithm
  const evaluation = evaluateShiftAndExpand(filtered, profile);

  if (evaluation.shiftTriggered) {
    newLog.shift_awarded = true;
  }

  saveSleepLogs(filtered);
  saveSleepProfile(evaluation.profile);

  // Enqueue sync record
  enqueueSleepSync('sleep_log', newLog);

  closeLogSleepModal();
  renderSleepDashboard();

  if (typeof showToast === 'function') {
    if (evaluation.shiftTriggered) {
      showToast(evaluation.message, 'success', 6000);
    } else if (evaluation.earlyAwakeningDetected) {
      showToast('Early awakening logged. Delay morning daylight until anchor time!', 'warning', 6000);
    } else {
      showToast(evaluation.message, 'info', 4000);
    }
  }
}

/**
 * Handles saving anchor settings.
 */
function handleAnchorSettingsSubmit() {
  const anchorVal = document.getElementById('cfg-anchor-wake-time').value;
  const targetBedVal = document.getElementById('cfg-target-bedtime').value;
  const caffeineVal = document.getElementById('cfg-caffeine-cutoff').value;

  if (!anchorVal || !targetBedVal) {
    if (typeof showToast === 'function') {
      showToast('Please specify valid anchor wake and bedtime values.', 'error');
    }
    return;
  }

  const profile = getSleepProfile();
  profile.anchor_wake_time = anchorVal;
  profile.target_bedtime = targetBedVal;
  profile.caffeine_cutoff_time = caffeineVal || '14:00';

  saveSleepProfile(profile);
  closeAnchorSettingsModal();
  renderSleepDashboard();

  if (typeof showToast === 'function') {
    showToast('Circadian anchor calibrated!', 'success');
  }
}

// Global exposure for integration and testing
if (typeof window !== 'undefined') {
  window.initSleepModule = initSleepModule;
  window.renderSleepDashboard = renderSleepDashboard;
  window.openLogSleepModal = openLogSleepModal;
  window.closeLogSleepModal = closeLogSleepModal;
  window.openAnchorSettingsModal = openAnchorSettingsModal;
  window.closeAnchorSettingsModal = closeAnchorSettingsModal;
  window.openNightInterruptionModal = openNightInterruptionModal;
  window.closeNightInterruptionModal = closeNightInterruptionModal;
  window.evaluateShiftAndExpand = evaluateShiftAndExpand;
  window.shiftTimeMinutes = shiftTimeMinutes;
  window.calculateCircadianCueWindows = calculateCircadianCueWindows;
}

// Auto-initialize when document is ready in browser
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initSleepModule());
  } else {
    initSleepModule();
  }
}

// If running in Node.js test environment, export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_CIRCADIAN_PROFILE,
    SLEEP_STORAGE_KEYS,
    toDateKey,
    shiftTimeMinutes,
    getMinuteDifference,
    formatTime12Hour,
    evaluateSingleNightSuccess,
    evaluateShiftAndExpand,
    calculateCircadianCueWindows
  };
}
