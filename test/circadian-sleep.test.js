/**
 * Automated Test Suite for VeloLog Circadian Sleep Coaching Module
 * Run with: node test/circadian-sleep.test.js
 */

const assert = require('assert');
const {
  DEFAULT_CIRCADIAN_PROFILE,
  SLEEP_STORAGE_KEYS,
  toDateKey,
  shiftTimeMinutes,
  getMinuteDifference,
  formatTime12Hour,
  evaluateSingleNightSuccess,
  evaluateShiftAndExpand,
  calculateCircadianCueWindows
} = require('../public/js/sleep.js');

let passedTests = 0;
let totalTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function describe(suiteName, fn) {
  console.log(`\n--- ${suiteName} ---`);
  fn();
}

// ============================================================================
// Test Suite: Time Helpers & 24h Circular Arithmetic
// ============================================================================
describe('Time Arithmetic & Circular Modulo 1440', () => {
  it('shifts time backward by 15 minutes during standard evening hours', () => {
    assert.strictEqual(shiftTimeMinutes('23:30', -15), '23:15');
    assert.strictEqual(shiftTimeMinutes('22:00', -15), '21:45');
  });

  it('correctly wraps backward across midnight', () => {
    assert.strictEqual(shiftTimeMinutes('00:00', -15), '23:45');
    assert.strictEqual(shiftTimeMinutes('00:10', -15), '23:55');
    assert.strictEqual(shiftTimeMinutes('00:05', -30), '23:35');
  });

  it('shifts time forward for morning daylight window', () => {
    assert.strictEqual(shiftTimeMinutes('07:00', 30), '07:30');
    assert.strictEqual(shiftTimeMinutes('06:45', 20), '07:05');
  });

  it('formats time to clean 12-hour AM/PM string', () => {
    assert.strictEqual(formatTime12Hour('07:00'), '7:00 AM');
    assert.strictEqual(formatTime12Hour('12:00'), '12:00 PM');
    assert.strictEqual(formatTime12Hour('23:30'), '11:30 PM');
    assert.strictEqual(formatTime12Hour('00:15'), '12:15 AM');
  });

  it('calculates minute differences accurately', () => {
    assert.strictEqual(getMinuteDifference('07:00', '07:30'), 30);
    assert.strictEqual(getMinuteDifference('07:00', '06:00'), -60);
  });
});

// ============================================================================
// Test Suite: Circadian Cue Windows
// ============================================================================
describe('Circadian Cue Windows Calculation', () => {
  it('calculates all 4 cue windows accurately from anchor wake and target bedtime', () => {
    const cues = calculateCircadianCueWindows('07:00', '23:30', '14:00');

    // 1. Morning Light: 07:00 to 07:30
    assert.strictEqual(cues.morningLight.start, '07:00');
    assert.strictEqual(cues.morningLight.end, '07:30');

    // 2. Caffeine Cut-off: 14:00
    assert.strictEqual(cues.caffeineCutoff.time, '14:00');

    // 3. Light Dimming: 90m before 23:30 = 22:00
    assert.strictEqual(cues.lightDimming.time, '22:00');

    // 4. Core Temp Drop: 90m to 60m before 23:30 = 22:00 to 22:30
    assert.strictEqual(cues.tempDrop.start, '22:00');
    assert.strictEqual(cues.tempDrop.end, '22:30');
  });

  it('handles midnight wrap in cue calculations', () => {
    const cues = calculateCircadianCueWindows('06:30', '00:15', '13:00');
    // 90m before 00:15 is 22:45
    assert.strictEqual(cues.lightDimming.time, '22:45');
    assert.strictEqual(cues.tempDrop.start, '22:45');
    assert.strictEqual(cues.tempDrop.end, '23:15');
  });
});

// ============================================================================
// Test Suite: Single Night Consolidation Criteria
// ============================================================================
describe('Single Night Consolidation Evaluation', () => {
  it('passes when fell asleep in <= 20 min, slept through, no early wake', () => {
    const log = {
      latency_minutes: 15,
      fell_asleep_under_20min: true,
      slept_through: true,
      early_awakening: false
    };
    assert.strictEqual(evaluateSingleNightSuccess(log), true);
  });

  it('fails when latency > 20 min', () => {
    const log = {
      latency_minutes: 35,
      fell_asleep_under_20min: false,
      slept_through: true,
      early_awakening: false
    };
    assert.strictEqual(evaluateSingleNightSuccess(log), false);
  });

  it('fails when early awakening is flagged', () => {
    const log = {
      latency_minutes: 10,
      fell_asleep_under_20min: true,
      slept_through: true,
      early_awakening: true
    };
    assert.strictEqual(evaluateSingleNightSuccess(log), false);
  });

  it('fails when sleep was interrupted', () => {
    const log = {
      latency_minutes: 10,
      fell_asleep_under_20min: true,
      slept_through: false,
      night_interruptions: 3,
      early_awakening: false
    };
    assert.strictEqual(evaluateSingleNightSuccess(log), false);
  });
});

// ============================================================================
// Test Suite: Shift-and-Expand Rolling 3-Day Engine
// ============================================================================
describe('Shift-and-Expand Rolling 3-Day Engine', () => {
  const baseProfile = {
    anchor_wake_time: '07:00',
    target_bedtime: '23:30',
    caffeine_cutoff_time: '14:00',
    consecutive_success_days: 0,
    total_shifts_applied: 0
  };

  it('increments streak on night 1 success without advancing bedtime', () => {
    const logs = [
      {
        sleep_date: '2026-10-01',
        latency_minutes: 15,
        fell_asleep_under_20min: true,
        slept_through: true,
        early_awakening: false
      }
    ];

    const result = evaluateShiftAndExpand(logs, baseProfile);
    assert.strictEqual(result.consecutiveSuccessDays, 1);
    assert.strictEqual(result.shiftTriggered, false);
    assert.strictEqual(result.profile.target_bedtime, '23:30');
  });

  it('increments streak on night 2 success without advancing bedtime', () => {
    const profileAfterNight1 = { ...baseProfile, consecutive_success_days: 1 };
    const logs = [
      {
        sleep_date: '2026-10-01',
        latency_minutes: 15,
        fell_asleep_under_20min: true,
        slept_through: true,
        early_awakening: false
      },
      {
        sleep_date: '2026-10-02',
        latency_minutes: 10,
        fell_asleep_under_20min: true,
        slept_through: true,
        early_awakening: false
      }
    ];

    const result = evaluateShiftAndExpand(logs, profileAfterNight1);
    assert.strictEqual(result.consecutiveSuccessDays, 2);
    assert.strictEqual(result.shiftTriggered, false);
    assert.strictEqual(result.profile.target_bedtime, '23:30');
  });

  it('triggers 15-minute bedtime shift on 3rd consecutive successful night', () => {
    const profileAfterNight2 = { ...baseProfile, consecutive_success_days: 2 };
    const logs = [
      {
        sleep_date: '2026-10-01',
        latency_minutes: 15,
        fell_asleep_under_20min: true,
        slept_through: true,
        early_awakening: false
      },
      {
        sleep_date: '2026-10-02',
        latency_minutes: 10,
        fell_asleep_under_20min: true,
        slept_through: true,
        early_awakening: false
      },
      {
        sleep_date: '2026-10-03',
        latency_minutes: 12,
        fell_asleep_under_20min: true,
        slept_through: true,
        early_awakening: false
      }
    ];

    const result = evaluateShiftAndExpand(logs, profileAfterNight2);
    assert.strictEqual(result.shiftTriggered, true);
    assert.strictEqual(result.profile.target_bedtime, '23:15'); // 23:30 - 15m
    assert.strictEqual(result.profile.total_shifts_applied, 1);
    assert.strictEqual(result.consecutiveSuccessDays, 0); // Reset for next 3-night block
  });

  it('locks bedtime steady and resets streak when early awakening occurs', () => {
    const profileWith2Streak = { ...baseProfile, consecutive_success_days: 2, target_bedtime: '23:15' };
    const logs = [
      {
        sleep_date: '2026-10-04',
        latency_minutes: 10,
        fell_asleep_under_20min: true,
        slept_through: true,
        early_awakening: true // Early awakening!
      }
    ];

    const result = evaluateShiftAndExpand(logs, profileWith2Streak);
    assert.strictEqual(result.shiftTriggered, false);
    assert.strictEqual(result.consecutiveSuccessDays, 0);
    assert.strictEqual(result.profile.target_bedtime, '23:15'); // Kept steady!
    assert.strictEqual(result.earlyAwakeningDetected, true);
  });

  it('locks bedtime steady and resets streak when latency > 20 min', () => {
    const profileWith1Streak = { ...baseProfile, consecutive_success_days: 1, target_bedtime: '23:15' };
    const logs = [
      {
        sleep_date: '2026-10-05',
        latency_minutes: 40,
        fell_asleep_under_20min: false,
        slept_through: true,
        early_awakening: false
      }
    ];

    const result = evaluateShiftAndExpand(logs, profileWith1Streak);
    assert.strictEqual(result.shiftTriggered, false);
    assert.strictEqual(result.consecutiveSuccessDays, 0);
    assert.strictEqual(result.profile.target_bedtime, '23:15'); // Kept steady!
  });

  it('handles multiple subsequent 15m shifts across cycles', () => {
    let profile = { ...baseProfile, target_bedtime: '23:15', consecutive_success_days: 2, total_shifts_applied: 1 };
    const logs = [
      {
        sleep_date: '2026-10-06',
        latency_minutes: 10,
        fell_asleep_under_20min: true,
        slept_through: true,
        early_awakening: false
      }
    ];

    const result = evaluateShiftAndExpand(logs, profile);
    assert.strictEqual(result.shiftTriggered, true);
    assert.strictEqual(result.profile.target_bedtime, '23:00'); // 23:15 -> 23:00
    assert.strictEqual(result.profile.total_shifts_applied, 2);
  });
});

// ============================================================================
// Test Suite: Constants & Storage Schemas
// ============================================================================
describe('Circadian Defaults & Storage Keys', () => {
  it('provides sensible baseline circadian defaults', () => {
    assert.strictEqual(DEFAULT_CIRCADIAN_PROFILE.anchor_wake_time, '07:00');
    assert.strictEqual(DEFAULT_CIRCADIAN_PROFILE.target_bedtime, '23:30');
    assert.strictEqual(DEFAULT_CIRCADIAN_PROFILE.caffeine_cutoff_time, '14:00');
    assert.strictEqual(DEFAULT_CIRCADIAN_PROFILE.consecutive_success_days, 0);
  });

  it('defines distinct local storage keys', () => {
    assert.ok(SLEEP_STORAGE_KEYS.PROFILE);
    assert.ok(SLEEP_STORAGE_KEYS.LOGS);
    assert.ok(SLEEP_STORAGE_KEYS.HABITS);
    assert.ok(SLEEP_STORAGE_KEYS.SYNC_QUEUE);
  });

  it('formats dates consistently as YYYY-MM-DD', () => {
    const d = new Date(2026, 9, 5); // Oct 5, 2026
    assert.strictEqual(toDateKey(d), '2026-10-05');
  });
});

console.log(`\n========================================`);
console.log(`Test Results: ${passedTests}/${totalTests} tests passed.`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
