/**
 * Stationary Bike Workout Tracker
 * Mobile-first vanilla JavaScript client with Supabase and Offline-First Sync.
 */

// ============================================================================
// 1. Configuration & Supabase Initialization
// ============================================================================
// Placeholder credentials: replace these with your project values from the Supabase dashboard
// or configure them dynamically in the in-app Settings modal.
const DEFAULT_SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const DEFAULT_SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const STORAGE_KEYS = {
  SUPABASE_URL: 'bike_tracker_supabase_url',
  SUPABASE_ANON_KEY: 'bike_tracker_supabase_anon_key',
  OFFLINE_QUEUE: 'bike_tracker_offline_queue'
};

function getConfig() {
  const url = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem(STORAGE_KEYS.SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;
  return { url: url.trim(), key: key.trim() };
}

function isSupabaseConfigured() {
  const { url, key } = getConfig();
  return (
    url &&
    key &&
    url !== 'YOUR_SUPABASE_PROJECT_URL' &&
    key !== 'YOUR_SUPABASE_ANON_KEY' &&
    url.startsWith('https://')
  );
}

let supabaseClient = null;

function initSupabase() {
  const { url, key } = getConfig();
  if (isSupabaseConfigured() && window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(url, key);
      return supabaseClient;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      supabaseClient = null;
    }
  } else {
    supabaseClient = null;
  }
  return supabaseClient;
}

// ============================================================================
// 2. Offline Storage & Background Sync
// ============================================================================
function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed reading offline queue:', err);
    return [];
  }
}

function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    updateOfflineIndicators();
  } catch (err) {
    console.error('Failed saving offline queue:', err);
  }
}

function enqueueOfflineWorkout(workout) {
  const queue = getOfflineQueue();
  const offlineRecord = {
    ...workout,
    _localId: 'offline_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    is_offline: true
  };
  queue.unshift(offlineRecord);
  saveOfflineQueue(queue);
  return offlineRecord;
}

function removeOfflineWorkout(localId) {
  const queue = getOfflineQueue();
  const filtered = queue.filter(item => item._localId !== localId);
  saveOfflineQueue(filtered);
}

let isSyncing = false;

async function syncOfflineWorkouts() {
  if (isSyncing) return;
  if (!navigator.onLine) return;
  if (!isSupabaseConfigured() || !supabaseClient) return;

  const queue = getOfflineQueue();
  if (!queue.length) return;

  isSyncing = true;
  updateOfflineIndicators();

  let syncedCount = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      const payload = {
        date: item.date || new Date().toISOString(),
        exercise_type: item.exercise_type || 'stationary_bicycle',
        distance_km: Number(item.distance_km),
        duration_minutes: Number(item.duration_minutes),
        calories_burned: Number(item.calories_burned),
        bike_program_level: Number(item.bike_program_level),
        bike_load_level: Number(item.bike_load_level)
      };

      const { error } = await supabaseClient.from('workouts').insert([payload]);
      if (error) {
        console.error('Error syncing workout item:', error);
        remaining.push(item);
      } else {
        syncedCount++;
      }
    } catch (syncErr) {
      console.error('Network exception during sync:', syncErr);
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  isSyncing = false;
  updateOfflineIndicators();

  if (syncedCount > 0) {
    showToast(`Synced ${syncedCount} offline workout${syncedCount > 1 ? 's' : ''} to cloud!`, 'success');
    if (activeTab === 'tab-recent') {
      loadRecentWorkouts();
    } else if (activeTab === 'tab-stats') {
      loadStats();
    }
  }
}

function updateOfflineIndicators() {
  const statusPill = document.getElementById('connection-pill');
  const statusText = document.getElementById('connection-status-text');
  const syncBadge = document.getElementById('sync-pending-badge');
  const queue = getOfflineQueue();

  const isOnline = navigator.onLine;

  if (statusPill && statusText) {
    if (isOnline) {
      statusPill.classList.remove('offline');
      statusText.textContent = 'Online';
    } else {
      statusPill.classList.add('offline');
      statusText.textContent = 'Offline';
    }
  }

  if (syncBadge) {
    if (queue.length > 0) {
      syncBadge.textContent = `${queue.length} pending`;
      syncBadge.classList.add('visible');
    } else {
      syncBadge.classList.remove('visible');
    }
  }
}

// ============================================================================
// 3. UI Toast Notification System
// ============================================================================
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>';
  } else {
    iconSvg = '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>';
  }

  toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOutToast 0.25s forwards';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// 4. Tab Navigation Management
// ============================================================================
let activeTab = 'tab-record';

function switchTab(tabId) {
  activeTab = tabId;

  // Update tab pane visibility
  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach(pane => {
    if (pane.id === tabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  // Update bottom tab buttons
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    }
  });

  // Scroll to top
  const mainContent = document.querySelector('.main-content');
  if (mainContent) mainContent.scrollTop = 0;

  // Trigger tab data loads
  if (tabId === 'tab-recent') {
    loadRecentWorkouts();
  } else if (tabId === 'tab-stats') {
    loadStats();
  }
}

// ============================================================================
// 5. Tab 1: Record Workout Form
// ============================================================================
function setupWorkoutForm() {
  const form = document.getElementById('workout-form');
  const programRange = document.getElementById('bike-program');
  const programVal = document.getElementById('bike-program-val');
  const loadRange = document.getElementById('bike-load');
  const loadVal = document.getElementById('bike-load-val');
  const submitBtn = document.getElementById('submit-btn');

  // Slider interactive readout listeners
  if (programRange && programVal) {
    programRange.addEventListener('input', e => {
      programVal.textContent = e.target.value;
    });
  }

  if (loadRange && loadVal) {
    loadRange.addEventListener('input', e => {
      loadVal.textContent = e.target.value;
    });
  }

  // Step button increment/decrement
  document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const step = parseInt(btn.dataset.step, 10);
      const slider = document.getElementById(targetId);
      if (!slider) return;

      let val = parseInt(slider.value, 10) + step;
      val = Math.max(1, Math.min(10, val));
      slider.value = val;
      slider.dispatchEvent(new Event('input'));
    });
  });

  // Form submission handler
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const exerciseType = document.getElementById('exercise-type').value;
      const distanceRaw = document.getElementById('distance-km').value;
      const durationRaw = document.getElementById('duration-minutes').value;
      const caloriesRaw = document.getElementById('calories-burned').value;
      const bikeProgram = parseInt(programRange.value, 10);
      const bikeLoad = parseInt(loadRange.value, 10);

      // Validation
      const distance = parseFloat(distanceRaw);
      const duration = parseInt(durationRaw, 10);
      const calories = parseInt(caloriesRaw, 10);

      if (isNaN(distance) || distance < 0) {
        showToast('Please enter a valid distance (>= 0 km)', 'error');
        document.getElementById('distance-km').focus();
        return;
      }

      if (isNaN(duration) || duration <= 0) {
        showToast('Please enter a valid duration in minutes (> 0 min)', 'error');
        document.getElementById('duration-minutes').focus();
        return;
      }

      if (isNaN(calories) || calories < 0) {
        showToast('Please enter valid calories burned (>= 0)', 'error');
        document.getElementById('calories-burned').focus();
        return;
      }

      const workoutRecord = {
        date: new Date().toISOString(),
        exercise_type: exerciseType || 'stationary_bicycle',
        distance_km: distance,
        duration_minutes: duration,
        calories_burned: calories,
        bike_program_level: bikeProgram,
        bike_load_level: bikeLoad
      };

      // Set button loading state
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      try {
        const canSyncOnline = navigator.onLine && isSupabaseConfigured() && supabaseClient;

        if (!canSyncOnline) {
          // Enqueue offline
          enqueueOfflineWorkout(workoutRecord);
          resetWorkoutForm();

          if (!isSupabaseConfigured()) {
            showToast('Workout saved locally! (Configure Supabase in ⚙️ settings to sync to cloud)', 'info', 5000);
          } else {
            showToast('Workout saved locally (offline). Will sync when reconnected!', 'info', 4000);
          }
        } else {
          // Insert directly to Supabase
          const { error } = await supabaseClient.from('workouts').insert([workoutRecord]);

          if (error) {
            console.error('Supabase insert error:', error);
            // Fallback to offline queue
            enqueueOfflineWorkout(workoutRecord);
            resetWorkoutForm();
            showToast('Cloud save failed, queued locally. Will retry automatically!', 'info', 4000);
          } else {
            resetWorkoutForm();
            showToast('Workout successfully recorded! 🚴‍♂️', 'success');
          }
        }
      } catch (err) {
        console.error('Submission error:', err);
        enqueueOfflineWorkout(workoutRecord);
        resetWorkoutForm();
        showToast('Saved to local offline queue!', 'info');
      } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });
  }
}

function resetWorkoutForm() {
  const form = document.getElementById('workout-form');
  if (!form) return;

  document.getElementById('exercise-type').value = 'stationary_bicycle';
  document.getElementById('distance-km').value = '';
  document.getElementById('duration-minutes').value = '';
  document.getElementById('calories-burned').value = '';

  const programSlider = document.getElementById('bike-program');
  const programVal = document.getElementById('bike-program-val');
  if (programSlider && programVal) {
    programSlider.value = 1;
    programVal.textContent = '1';
  }

  const loadSlider = document.getElementById('bike-load');
  const loadVal = document.getElementById('bike-load-val');
  if (loadSlider && loadVal) {
    loadSlider.value = 5;
    loadVal.textContent = '5';
  }
}

// ============================================================================
// 6. Tab 2: Stats Page
// ============================================================================
let currentStatsPeriod = 'monthly'; // 'monthly' | 'all'

function setupStatsListeners() {
  const btnMonthly = document.getElementById('btn-period-monthly');
  const btnAll = document.getElementById('btn-period-all');

  if (btnMonthly && btnAll) {
    btnMonthly.addEventListener('click', () => {
      currentStatsPeriod = 'monthly';
      btnMonthly.classList.add('active');
      btnAll.classList.remove('active');
      loadStats();
    });

    btnAll.addEventListener('click', () => {
      currentStatsPeriod = 'all';
      btnAll.classList.add('active');
      btnMonthly.classList.remove('active');
      loadStats();
    });
  }
}

async function fetchAllWorkoutsData() {
  let remoteWorkouts = [];

  if (isSupabaseConfigured() && supabaseClient && navigator.onLine) {
    try {
      const { data, error } = await supabaseClient
        .from('workouts')
        .select('*')
        .order('date', { ascending: false });

      if (!error && Array.isArray(data)) {
        remoteWorkouts = data;
      } else if (error) {
        console.warn('Error fetching stats workouts from Supabase:', error);
      }
    } catch (err) {
      console.warn('Network exception fetching stats:', err);
    }
  }

  // Merge with any pending offline items
  const offlineItems = getOfflineQueue();
  return [...offlineItems, ...remoteWorkouts];
}

async function loadStats() {
  const container = document.getElementById('stats-content');
  if (!container) return;

  const allWorkouts = await fetchAllWorkoutsData();

  // Filter based on chosen period
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const filteredWorkouts = allWorkouts.filter(w => {
    if (currentStatsPeriod === 'all') return true;
    if (!w.date) return false;
    const d = new Date(w.date);
    return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  renderStats(filteredWorkouts);
}

function renderStats(workouts) {
  const count = workouts.length;

  const countEl = document.getElementById('stat-total-rides');
  const distEl = document.getElementById('stat-total-dist');
  const durEl = document.getElementById('stat-total-dur');
  const calEl = document.getElementById('stat-total-cal');

  const avgDurEl = document.getElementById('stat-avg-dur');
  const avgDistEl = document.getElementById('stat-avg-dist');
  const avgCalEl = document.getElementById('stat-avg-cal');
  const avgProgEl = document.getElementById('stat-avg-prog');
  const avgLoadEl = document.getElementById('stat-avg-load');

  if (count === 0) {
    if (countEl) countEl.innerHTML = '0 <span class="stat-unit">rides</span>';
    if (distEl) distEl.innerHTML = '0.0 <span class="stat-unit">km</span>';
    if (durEl) durEl.innerHTML = '0m';
    if (calEl) calEl.innerHTML = '0 <span class="stat-unit">kcal</span>';

    if (avgDurEl) avgDurEl.innerHTML = '-- <span class="stat-unit">min</span>';
    if (avgDistEl) avgDistEl.innerHTML = '-- <span class="stat-unit">km</span>';
    if (avgCalEl) avgCalEl.innerHTML = '-- <span class="stat-unit">kcal</span>';
    if (avgProgEl) avgProgEl.innerHTML = '-- <span class="stat-unit">lvl</span>';
    if (avgLoadEl) avgLoadEl.innerHTML = '-- <span class="stat-unit">lvl</span>';
    return;
  }

  // Calculate Totals
  const totalDistance = workouts.reduce((sum, w) => sum + (parseFloat(w.distance_km) || 0), 0);
  const totalDurationMinutes = workouts.reduce((sum, w) => sum + (parseInt(w.duration_minutes, 10) || 0), 0);
  const totalCalories = workouts.reduce((sum, w) => sum + (parseInt(w.calories_burned, 10) || 0), 0);

  // Calculate Averages
  const avgDuration = totalDurationMinutes / count;
  const avgDistance = totalDistance / count;
  const avgCalories = totalCalories / count;
  const avgProgram = workouts.reduce((sum, w) => sum + (parseInt(w.bike_program_level, 10) || 0), 0) / count;
  const avgLoad = workouts.reduce((sum, w) => sum + (parseInt(w.bike_load_level, 10) || 0), 0) / count;

  // Format Duration into Hours and Minutes
  const formattedTotalDuration = formatDuration(totalDurationMinutes);

  // Populate UI
  if (countEl) countEl.innerHTML = `${count} <span class="stat-unit">ride${count > 1 ? 's' : ''}</span>`;
  if (distEl) distEl.innerHTML = `${totalDistance.toFixed(1)} <span class="stat-unit">km</span>`;
  if (durEl) durEl.innerHTML = formattedTotalDuration;
  if (calEl) calEl.innerHTML = `${totalCalories.toLocaleString()} <span class="stat-unit">kcal</span>`;

  if (avgDurEl) avgDurEl.innerHTML = `${Math.round(avgDuration)} <span class="stat-unit">min</span>`;
  if (avgDistEl) avgDistEl.innerHTML = `${avgDistance.toFixed(1)} <span class="stat-unit">km</span>`;
  if (avgCalEl) avgCalEl.innerHTML = `${Math.round(avgCalories).toLocaleString()} <span class="stat-unit">kcal</span>`;
  if (avgProgEl) avgProgEl.innerHTML = `${avgProgram.toFixed(1)} <span class="stat-unit">/ 10</span>`;
  if (avgLoadEl) avgLoadEl.innerHTML = `${avgLoad.toFixed(1)} <span class="stat-unit">/ 10</span>`;
}

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) {
    return `${mins}m`;
  }
  return `${hours}h ${mins}m`;
}

// ============================================================================
// 7. Tab 3: Recent Workouts (Last 10)
// ============================================================================
async function loadRecentWorkouts() {
  const listContainer = document.getElementById('recent-workouts-list');
  const refreshBtn = document.getElementById('btn-refresh-recent');
  if (!listContainer) return;

  if (refreshBtn) refreshBtn.classList.add('spinning');

  let remoteWorkouts = [];

  if (isSupabaseConfigured() && supabaseClient && navigator.onLine) {
    try {
      const { data, error } = await supabaseClient
        .from('workouts')
        .select('*')
        .order('date', { ascending: false })
        .limit(10);

      if (!error && Array.isArray(data)) {
        remoteWorkouts = data;
      } else if (error) {
        console.warn('Error fetching recent workouts:', error);
      }
    } catch (err) {
      console.warn('Network exception loading recent workouts:', err);
    }
  }

  // Merge pending offline workouts at the front
  const offlineQueue = getOfflineQueue();
  const combined = [...offlineQueue, ...remoteWorkouts].slice(0, 10);

  renderRecentWorkouts(combined);

  if (refreshBtn) {
    setTimeout(() => refreshBtn.classList.remove('spinning'), 300);
  }
}

function renderRecentWorkouts(workouts) {
  const listContainer = document.getElementById('recent-workouts-list');
  if (!listContainer) return;

  if (!workouts || workouts.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h4 class="empty-title">No Workouts Yet</h4>
        <p class="empty-text">Your completed rides will show up here. Hop on the bike and record your first session!</p>
        <button class="btn-secondary" onclick="switchTab('tab-record')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
          Record Workout
        </button>
      </div>
    `;
    return;
  }

  const html = workouts.map(item => {
    const isOffline = !!item.is_offline;
    const formattedDate = formatWorkoutDate(item.date);
    const exerciseName = formatExerciseName(item.exercise_type);

    return `
      <div class="workout-card">
        <div class="workout-card-top">
          <div class="workout-date-group">
            <div class="workout-date-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <span class="workout-date-text">${formattedDate}</span>
          </div>
          <div class="workout-badges">
            <span class="badge-tag type">${exerciseName}</span>
            ${isOffline ? '<span class="badge-tag sync-pending">Pending Sync</span>' : ''}
          </div>
        </div>

        <div class="workout-metrics-row">
          <div class="metric-item">
            <span class="metric-label">Distance</span>
            <span class="metric-val">${parseFloat(item.distance_km || 0).toFixed(1)}<small>km</small></span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Duration</span>
            <span class="metric-val">${parseInt(item.duration_minutes || 0, 10)}<small>min</small></span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Calories</span>
            <span class="metric-val">${parseInt(item.calories_burned || 0, 10)}<small>kcal</small></span>
          </div>
        </div>

        <div class="workout-settings-row">
          <div class="chip-setting">
            <span>Program:</span>
            <span class="chip-val">P${item.bike_program_level}</span>
          </div>
          <span class="chip-divider"></span>
          <div class="chip-setting load">
            <span>Load:</span>
            <span class="chip-val">L${item.bike_load_level}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  listContainer.innerHTML = html;
}

function formatExerciseName(raw) {
  if (!raw) return 'Stationary Bike';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatWorkoutDate(dateString) {
  if (!dateString) return 'Just now';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today • ${timeStr}`;
  if (isYesterday) return `Yesterday • ${timeStr}`;

  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` • ${timeStr}`;
}

// ============================================================================
// 8. Settings Modal (Credentials Management)
// ============================================================================
function setupSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const openBtn = document.getElementById('btn-open-settings');
  const closeBtn = document.getElementById('btn-close-settings');
  const saveBtn = document.getElementById('btn-save-settings');
  const resetBtn = document.getElementById('btn-reset-settings');

  const urlInput = document.getElementById('cfg-supabase-url');
  const keyInput = document.getElementById('cfg-supabase-key');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      const cfg = getConfig();
      if (urlInput) urlInput.value = cfg.url === DEFAULT_SUPABASE_URL ? '' : cfg.url;
      if (keyInput) keyInput.value = cfg.key === DEFAULT_SUPABASE_ANON_KEY ? '' : cfg.key;
      modal.classList.add('open');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const newUrl = urlInput.value.trim();
      const newKey = keyInput.value.trim();

      if (newUrl && !newUrl.startsWith('https://')) {
        showToast('Supabase URL must start with https://', 'error');
        return;
      }

      if (newUrl) {
        localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, newUrl);
      } else {
        localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
      }

      if (newKey) {
        localStorage.setItem(STORAGE_KEYS.SUPABASE_ANON_KEY, newKey);
      } else {
        localStorage.removeItem(STORAGE_KEYS.SUPABASE_ANON_KEY);
      }

      initSupabase();
      updateOfflineIndicators();
      modal.classList.remove('open');

      showToast('Settings saved successfully!', 'success');

      if (isSupabaseConfigured() && navigator.onLine) {
        syncOfflineWorkouts();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
      localStorage.removeItem(STORAGE_KEYS.SUPABASE_ANON_KEY);
      initSupabase();
      updateOfflineIndicators();
      modal.classList.remove('open');
      showToast('Settings reset to defaults', 'info');
    });
  }
}

// ============================================================================
// 9. Application Lifecycle & Entrypoint
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize client
  initSupabase();

  // Bottom tab buttons listeners
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      if (targetTab) switchTab(targetTab);
    });
  });

  // Recent workouts refresh button
  const btnRefreshRecent = document.getElementById('btn-refresh-recent');
  if (btnRefreshRecent) {
    btnRefreshRecent.addEventListener('click', () => {
      loadRecentWorkouts();
    });
  }

  // Setup form, stats, and settings modal
  setupWorkoutForm();
  setupStatsListeners();
  setupSettingsModal();

  // Network and sync listeners
  window.addEventListener('online', () => {
    updateOfflineIndicators();
    showToast('Internet connection restored!', 'success');
    syncOfflineWorkouts();
  });

  window.addEventListener('offline', () => {
    updateOfflineIndicators();
    showToast('You are currently offline. New workouts will be stored locally.', 'info');
  });

  // Initial indicator update and sync
  updateOfflineIndicators();
  if (navigator.onLine && isSupabaseConfigured()) {
    syncOfflineWorkouts();
  }

  // Expose switchTab globally for inline buttons
  window.switchTab = switchTab;
});
