import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://eiiwcvxjtnzetkyjyudi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaXdjdnhqdG56ZXRreWp5dWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTUzNTYsImV4cCI6MjA5Nzg5MTM1Nn0.RXDV2M02Gkgd4GBK4LEz_GVSjr5wqtR27z_Q_EWyHxQ";
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_coach_payment_link";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const userEmailDisplay = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const athleteList = document.getElementById('athleteList');
const inviteLinkContainer = document.getElementById('inviteLinkContainer');
const coachExpirationBanner = document.getElementById('coachExpirationBanner');
const restartCoachBtn = document.getElementById('restartCoachBtn');
const coachUpgradeBtn = document.getElementById('coachUpgradeBtn');
const inactiveInspector = document.getElementById('inactiveInspector');
const activeInspector = document.getElementById('activeInspector');
const inspectAthleteName = document.getElementById('inspectAthleteName');
const inspectAthleteEmail = document.getElementById('inspectAthleteEmail');
const athleteStatusSelect = document.getElementById('athleteStatusSelect');
const athleteHistoryGrid = document.getElementById('athleteHistoryGrid');
const inspectBiometricsBlock = document.getElementById('inspectBiometricsBlock');
const inspectBioWeight = document.getElementById('inspectBioWeight');
const inspectBioWaist = document.getElementById('inspectBioWaist');
const inspectBioCal = document.getElementById('inspectBioCal');
const brandForm = document.getElementById('brandForm');
const brandPrimaryColor = document.getElementById('brandPrimaryColor');
const brandSecondaryColor = document.getElementById('brandSecondaryColor');
const brandLogoUrl = document.getElementById('brandLogoUrl');
const brandPhone = document.getElementById('brandPhone');
const brandAddress = document.getElementById('brandAddress');
const brandStatusMsg = document.getElementById('brandStatusMsg');


let currentCoachId = null;
let activeClientId = null;
let coachChartInstance = null;

// --- CORE FUNCTIONS ---

const mainCommentFeed = document.getElementById('mainCommentFeed');
const coachMessageInput = document.getElementById('coachMessageInput');
const sendCoachMessageBtn = document.getElementById('sendCoachMessageBtn');

// Load general thread for the selected athlete
async function loadCoachCommunication(athleteId) {
  if (!mainCommentFeed) return;
  mainCommentFeed.innerHTML = '';

  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('user_id', athleteId) // Assuming comments are tied to the user
    .order('created_at', { ascending: true });

  comments?.forEach(c => appendComment(c));
}

// Send a message
if (sendCoachMessageBtn) {
  sendCoachMessageBtn.addEventListener('click', async () => {
    if (!activeClientId) return;
    const message = coachMessageInput.value.trim();
    if (!message) return;

    try {
      // 1. Find the client's latest logged session to anchor the comment to
      const { data: latestWorkout, error: fetchErr } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', activeClientId)
        .order('log_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (!latestWorkout) {
        alert("This client has not logged any workouts yet. A message cannot be sent until they record at least one session on their dashboard.");
        return;
      }

      // 2. Insert the comment under the active chat thread
      const { error: insertErr } = await supabase
        .from('comments')
        .insert([{
          user_id: activeClientId,
          workout_id: latestWorkout.id,
          sender_id: currentCoachId,
          message: message
        }]);

      if (insertErr) throw insertErr;

      // 3. Instant Widget Reload: Clear the input and reload the conversation feed
      coachMessageInput.value = '';
      await loadMessageCenterWidget(activeClientId);

    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message: " + err.message);
    }
  });
}



async function fetchRoster() {
  const { data: clients, error } = await supabase
    .from('profiles')
    .select('id, full_name, client_status, coach_id')
    .eq('coach_id', currentCoachId)
    .neq('id', currentCoachId);

  if (error) {
    console.error("Roster query error:", error.message);
    return;
  }

  athleteList.innerHTML = clients?.length ? '' : '<p>No athletes found.</p>';
  clients?.forEach(client => {
    const item = document.createElement('div');
    item.className = 'athlete-roster-item';
    item.innerHTML = `<div><strong>${client.full_name || 'Anonymous athlete'}</strong></div>`;
    item.addEventListener('click', () => inspectAthlete(client));
    athleteList.appendChild(item);
  });
}

// --- INITIALIZATION ---



// Routing Security Guard: Only allow valid coaches in this directory and apply white-label branding
async function initCoachDashboard() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      window.location.href = '/login/';
      return;
    }

    currentCoachId = session.user.id;
    if (userEmailDisplay) {
      userEmailDisplay.textContent = session.user.email;
    }

    // FIX: Retrieve ALL white-label branding columns from the database on load
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('full_name, role, theme_primary_color, theme_secondary_color, background_color, theme_mode, logo_url, contact_phone, contact_address, trial_ends_at, subscription_status')
      .eq('id', currentCoachId)
      .single();

    if (profileErr || !profile || profile.role !== 'coach') {
      window.location.href = '/login/';
      return;
    }

    // Apply branding settings visually to the coach's own dashboard
    applyCoachBranding(profile);

    // Check coach trial/billing expiration with a safe date fallback
    const trialEndsDate = profile.trial_ends_at
      ? new Date(profile.trial_ends_at)
      : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

    const now = new Date();
    const isPaid = profile.subscription_status === 'active';
    const isTrialActive = profile.subscription_status === 'trial' && (trialEndsDate >= now);

    if (!isPaid && !isTrialActive) {
      if (coachExpirationBanner) coachExpirationBanner.classList.remove('hidden');
      if (coachUpgradeBtn) coachUpgradeBtn.classList.add('hidden');
    } else {
      if (coachUpgradeBtn) coachUpgradeBtn.classList.remove('hidden');
    }

    // Populate invite referral link
    const inviteLink = `${window.location.origin}/signup/?coach=${currentCoachId}`;
    if (inviteLinkContainer) inviteLinkContainer.textContent = inviteLink;

    // FIX: Pre-populate ALL brand customization form inputs so saved states are preserved
    const brandAppNameInput = document.getElementById('brandAppName');
    const brandBgColorInput = document.getElementById('brandBgColor');
    const brandThemeModeInput = document.getElementById('brandThemeMode');

    if (brandAppNameInput) brandAppNameInput.value = profile.full_name || '';
    if (brandPrimaryColor) brandPrimaryColor.value = profile.theme_primary_color || '#39ff14';
    if (brandSecondaryColor) brandSecondaryColor.value = profile.theme_secondary_color || '#29d609';
    if (brandBgColorInput) brandBgColorInput.value = profile.background_color || '#0c0d10';
    if (brandThemeModeInput) brandThemeModeInput.value = profile.theme_mode || 'dark';
    if (brandLogoUrl) brandLogoUrl.value = profile.logo_url || '';
    if (brandPhone) brandPhone.value = profile.contact_phone || '';
    if (brandAddress) brandAddress.value = profile.contact_address || '';

    // Fetch team roster
    fetchRoster();
    setupRealtimeComments();

    // FIX: Grab the correct dropdown element and call the active chart drawer
    const selector = document.getElementById('coachChartSelector');
    if (selector) {
      selector.addEventListener('change', () => {
        if (activeClientId) {
          loadChartWidget(activeClientId);
        }
      });
    }
  } catch (err) {
    console.error("Dashboard Init Error:", err);
  }
}


// --- START APP ---
document.addEventListener('DOMContentLoaded', initCoachDashboard);

// --- BRANDING FORM ---
if (brandForm) {
  brandForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (brandStatusMsg) {
      brandStatusMsg.className = "hidden";
      brandStatusMsg.textContent = "";
    }

    // Capture values from the NEW HTML inputs
    const updates = {
      full_name: document.getElementById('brandAppName').value.trim(),
      theme_primary_color: brandPrimaryColor.value,
      theme_secondary_color: brandSecondaryColor.value,
      background_color: document.getElementById('brandBgColor').value,
      theme_mode: document.getElementById('brandThemeMode').value,
      logo_url: brandLogoUrl.value.trim() || null,
      contact_phone: brandPhone.value.trim() || null,
      contact_address: brandAddress.value.trim() || null
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentCoachId);

      if (error) throw error;

      // Apply the branding changes visually
      applyCoachBranding(updates);
    } catch (err) {
      // Optional: surface the error to the user
      console.error('Brand update failed:', err);
    }                               // ← close `try…catch`
  });                              // ← close `brandForm.addEventListener`
}                                 // ← close `if (brandForm)`


// ... (Add your existing inspectAthlete, renderCoachChart, fetchAthleteHistory, and comment logic below here)
// Inspect specific athlete portfolio logs & metrics
// --- 1. THE MANAGER ---
// 1. THE DISPATCHER: This function handles the "Switching" logic
async function inspectAthlete(client) {
  console.log("Inspecting athlete:", client.full_name, "ID:", client.id);
  activeClientId = client.id;

  // Show the inspector panel
  if (inactiveInspector) inactiveInspector.classList.add('hidden');
  if (activeInspector) activeInspector.classList.remove('hidden');
  if (inspectAthleteName) inspectAthleteName.textContent = client.full_name;
  if (athleteStatusSelect) athleteStatusSelect.value = client.client_status || 'active';

  // PROTECTED WIDGET SEQUENCE: Wrapped in individual try/catch blocks
  // If one widget fails, it CANNOT block the others from loading!
  try {
    await loadBiometricWidget(client.id);
  } catch (e) {
    console.warn("Biometrics widget failed to load:", e);
  }

  try {
    await loadChartWidget(client.id);
  } catch (e) {
    console.warn("Chart widget failed to load:", e);
  }

  try {
    await loadAuditFeedWidget(client.id);
  } catch (e) {
    console.warn("Audit Feed widget failed to load:", e);
  }

  try {
    await loadMessageCenterWidget(client.id);
  } catch (e) {
    console.warn("Message Center widget failed to load:", e);
  }
}

// --- 2. THE WIDGETS ---

async function loadBiometricWidget(clientId) {
  console.log("Loading Biometrics for:", clientId);
  try {
    const { data: bRec } = await supabase
      .from('workout_logs')
      .select('metrics')
      .eq('user_id', clientId)
      .eq('exercise_name', 'Biometric Snapshot Engine')
      .order('log_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bRec?.metrics && inspectBiometricsBlock) {
      inspectBiometricsBlock.classList.remove('hidden');
      inspectBioWeight.textContent = bRec.metrics.weight || '-';
      inspectBioWaist.textContent = bRec.metrics.waist || '-';
      inspectBioCal.textContent = bRec.metrics.target_calories || '-';
    } else if (inspectBiometricsBlock) {
      inspectBiometricsBlock.classList.add('hidden');
    }
  } catch (err) {
    console.warn("Biometric widget failed:", err);
  }
}

// Add this as your primary Chart Widget add
async function loadChartWidget(clientId) {
  console.log("Loading chart for:", clientId);
  const ctx = document.getElementById('coachAnalyticsChart');
  if (!ctx) {
    console.warn("Canvas element 'coachAnalyticsChart' not found.");
    return;
  }

  // 1. Clean up old chart instance safely before drawing
  if (coachChartInstance) {
    coachChartInstance.destroy();
    coachChartInstance = null;
  }

  // 2. FRESH FETCH: Read the dropdown selection freshly from the DOM
  const selector = document.getElementById('coachChartSelector');
  const selectedChartType = selector ? selector.value : 'volume';
  console.log("Drawing chart for type:", selectedChartType);

  try {
    if (selectedChartType === 'volume') {
      // Fetch Strength Volumes
      const { data: logs, error } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', clientId)
        .eq('category', 'weight_training')
        .order('log_date', { ascending: true });

      if (error) {
        console.error("Error fetching volume data:", error);
        drawEmptyChartPlaceholder(ctx, "Error loading strength data.");
        return;
      }

      if (!logs || logs.length === 0) {
        drawEmptyChartPlaceholder(ctx, "No strength volume data available.");
        return;
      }

      // Compute volume calculations
      const volumeByDate = {};
      logs.forEach(log => {
        if (log.exercise_name === 'Daily Nutritional Matrix') return;
        const sets = log.metrics?.sets || [];
        let sessionVolume = 0;
        sets.forEach(s => {
          sessionVolume += ((parseInt(s.reps, 10) || 0) * (parseFloat(s.weight) || 0));
        });
        if (sessionVolume > 0) {
          volumeByDate[log.log_date] = (volumeByDate[log.log_date] || 0) + sessionVolume;
        }
      });

      if (Object.keys(volumeByDate).length === 0) {
        drawEmptyChartPlaceholder(ctx, "No strength volume data available.");
        return;
      }

      // Create new Strength Volume chart
      coachChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: Object.keys(volumeByDate),
          datasets: [{
            label: 'Strength Volume (lbs)',
            data: Object.values(volumeByDate),
            borderColor: '#39ff14',
            backgroundColor: 'rgba(57, 255, 20, 0.03)',
            borderWidth: 2,
            tension: 0.25,
            fill: true
          }]
        },
        options: getCommonChartOptions()
      });

    } else if (selectedChartType === 'cardio') {
      // Fetch Cardio Outputs
      const { data: logs, error } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', clientId)
        .eq('category', 'cardio')
        .order('log_date', { ascending: true });

      if (error) {
        console.error("Error fetching cardio data:", error);
        drawEmptyChartPlaceholder(ctx, "Error loading cardio data.");
        return;
      }

      if (!logs || logs.length === 0) {
        drawEmptyChartPlaceholder(ctx, "No cardio history logs available.");
        return;
      }

      // Calculate Average Speed (Distance / Duration) per log date
      const speedByDate = {};
      logs.forEach(log => {
        const sets = log.metrics?.sets || [];
        const distance = parseFloat(sets[0]?.distance || 0);
        const duration = parseFloat(sets[0]?.duration || 0);

        if (duration > 0 && distance > 0) {
          // Speed = (Distance / Duration) * 60 (Calculates MPH / KPH)
          const avgSpeed = (distance / duration) * 60;
          speedByDate[log.log_date] = parseFloat(avgSpeed.toFixed(2));
        }
      });

      if (Object.keys(speedByDate).length === 0) {
        drawEmptyChartPlaceholder(ctx, "No speed progress logged yet.");
        return;
      }

      // Create a single-line Cardio Efficiency trend chart
      coachChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: Object.keys(speedByDate),
          datasets: [{
            label: 'Average Speed (mph / kph)',
            data: Object.values(speedByDate),
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.04)',
            borderWidth: 2.5,
            tension: 0.25,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8a8f98' } },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#8a8f98' },
              title: { display: true, text: 'Avg Speed (mph / kph)', color: '#38bdf8' }
            }
          }
        }
      });

    } else {
      // Fetch Behavioral Diagnostics (BMI vs. Diet)
      const { data: bioLogs, error: bioError } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', clientId)
        .eq('exercise_name', 'Biometric Snapshot Engine')
        .order('log_date', { ascending: true });

      const { data: dietLogs, error: dietError } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', clientId)
        .eq('exercise_name', 'Daily Nutritional Matrix')
        .order('log_date', { ascending: true });

      if (bioError || dietError) {
        console.error("Error fetching comparison metrics:", bioError || dietError);
        drawEmptyChartPlaceholder(ctx, "Error loading comparison data.");
        return;
      }

      if ((!bioLogs || bioLogs.length === 0) && (!dietLogs || dietLogs.length === 0)) {
        drawEmptyChartPlaceholder(ctx, "No metrics available for Diet comparisons.");
        return;
      }

      // Merge timelines of daily diet logs and weekly biometrics cleanly
      const allDates = Array.from(new Set([
        ...bioLogs.map(b => b.log_date),
        ...dietLogs.map(d => d.log_date)
      ])).sort();

      const bmiByDate = {};
      bioLogs.forEach(b => {
        if (b.metrics?.bmi) {
          bmiByDate[b.log_date] = parseFloat(b.metrics.bmi);
        }
      });

      const dietByDate = {};
      dietLogs.forEach(d => {
        if (d.metrics?.diet_rating) {
          dietByDate[d.log_date] = parseInt(d.metrics.diet_rating, 10);
        }
      });

      // Align arrays to unified timeline, falling back to 'null' so spanGaps links points
      const bmiData = allDates.map(date => bmiByDate[date] !== undefined ? bmiByDate[date] : null);
      const dietData = allDates.map(date => dietByDate[date] !== undefined ? dietByDate[date] : null);

      coachChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: allDates,
          datasets: [
            {
              label: 'BMI Progress',
              data: bmiData,
              borderColor: '#e11d48',
              backgroundColor: 'transparent',
              borderWidth: 2,
              yAxisID: 'y',
              spanGaps: true
            },
            {
              label: 'Diet Rating (1-5)',
              data: dietData,
              borderColor: '#39ff14',
              backgroundColor: 'rgba(57, 255, 20, 0.05)',
              borderWidth: 2,
              yAxisID: 'y1',
              spanGaps: true,
              fill: true,
              showLine: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: { display: true, text: 'BMI Score', color: '#e11d48' },
              grid: { color: 'rgba(255,255,255,0.05)' }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              min: 1,
              max: 5,
              ticks: { stepSize: 1 },
              title: { display: true, text: 'Diet Rating (1-5)', color: '#39ff14' },
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
    }
  } catch (err) {
    console.error("Chart widget error:", err);
    drawEmptyChartPlaceholder(ctx, "Error loading chart.");
  }
}

async function loadAuditFeedWidget(clientId) {
  console.log("Loading Audit Feed for:", clientId);
  const grid = document.getElementById('athleteHistoryGrid');
  if (!grid) return;

  grid.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Loading audit feed...</p>';

  const { data: workouts, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', clientId)
    .order('log_date', { ascending: false });

  if (error) {
    console.error("Audit Feed Error:", error);
    grid.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem;">Error loading history.</p>';
    return;
  }

  if (!workouts || workouts.length === 0) {
    grid.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No history logged yet.</p>';
    return;
  }

  // 1. Grouping Phase (Consolidate separate logs by date)
  const groupedByDate = {};
  workouts.forEach(log => {
    if (!groupedByDate[log.log_date]) {
      groupedByDate[log.log_date] = {
        date: log.log_date,
        lifts: [],
        cardio: null,
        diet: null,
        routine_focus: log.routine_focus || ''
      };
    }
    if (log.category === 'cardio') {
      groupedByDate[log.log_date].cardio = log;
    } else if (log.exercise_name === 'Daily Nutritional Matrix') {
      groupedByDate[log.log_date].diet = log;
    } else if (log.exercise_name !== 'Biometric Snapshot Engine') {
      groupedByDate[log.log_date].lifts.push(log);
    }
    if (log.routine_focus && !groupedByDate[log.log_date].routine_focus) {
      groupedByDate[log.log_date].routine_focus = log.routine_focus;
    }
  });

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

  // 2. Render Selector Dropdown and Active Audit Card Container
  grid.innerHTML = `
    <div style="margin-bottom: 0.75rem;">
      <label style="display: block; font-size: 0.75rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.35rem; letter-spacing: 0.5px;">Select Session Date</label>
      <select id="coachAuditDateSelect" style="background: var(--bg-main); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 0.5rem; border-radius: 6px; width: 100%; font-size: 0.85rem; font-weight: 600; cursor: pointer;"></select>
    </div>
    <div id="coachAuditDisplayCard" style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 1rem; max-height: 220px; overflow-y: auto;">
      <p style="color: var(--text-muted); font-size: 0.8rem;">Select a date to audit session.</p>
    </div>
  `;

  const coachAuditDateSelect = document.getElementById('coachAuditDateSelect');
  const coachAuditDisplayCard = document.getElementById('coachAuditDisplayCard');

  // Populate Dropdown Options
  sortedDates.forEach(dateStr => {
    const opt = document.createElement('option');
    opt.value = dateStr;
    opt.textContent = dateStr;
    coachAuditDateSelect.appendChild(opt);
  });

  // 3. Sub-Renderer: Updates display box instantly on date select
  function renderAuditDateDetails(dateStr) {
    if (!coachAuditDisplayCard) return;

    const dayGroup = groupedByDate[dateStr];
    const dietVal = dayGroup.diet?.metrics?.diet_rating || null;
    const liftCount = dayGroup.lifts.length;
    const hasCardio = dayGroup.cardio !== null;
    const focusName = dayGroup.routine_focus || (liftCount > 0 ? "Strength Training" : (hasCardio ? "Cardio Session" : "Nutrition Log"));

    let cardHTML = `
      <div style="font-size: 0.75rem; font-weight: bold; color: var(--brand-primary); text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem;">📋 ${focusName}</div>
    `;

    // Display Weight Training Exercises
    if (liftCount > 0) {
      const exercisesOnThisDay = {};
      dayGroup.lifts.forEach(workout => {
        if (!exercisesOnThisDay[workout.exercise_name]) {
          exercisesOnThisDay[workout.exercise_name] = [];
        }
        const setsData = Array.isArray(workout.metrics?.sets) ? workout.metrics.sets : [];
        exercisesOnThisDay[workout.exercise_name].push(...setsData);
      });

      Object.keys(exercisesOnThisDay).forEach(exerciseName => {
        const setsList = exercisesOnThisDay[exerciseName].map(s => `Set ${s.set}: ${s.reps} reps @ ${s.weight} lbs/kg`).join(' | ');
        cardHTML += `
          <div style="margin-bottom: 0.6rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.02);">
            <div style="font-size: 0.85rem; font-weight: 600; color: #fff;">${exerciseName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.1rem;">${setsList}</div>
          </div>`;
      });
    }

    // Display Cardio Summary
    if (dayGroup.cardio) {
      const cardioSets = Array.isArray(dayGroup.cardio.metrics?.sets) ? dayGroup.cardio.metrics.sets : [];
      const topCardio = cardioSets[0] || { duration: 0, distance: 0 };
      cardHTML += `
        <div style="margin-top: 0.6rem; padding-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.05);">
          <div style="font-size: 0.85rem; font-weight: 600; color: #fff;">🏃 Cardio Session</div>
          <div style="font-size: 0.75rem; color: #38bdf8; margin-top: 0.1rem;">${topCardio.distance} miles/km in ${topCardio.duration} mins</div>
        </div>`;
    }

    // Display Diet Metric
    if (dietVal) {
      cardHTML += `
        <div style="margin-top: 0.6rem; padding-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.05);">
          <div style="font-size: 0.85rem; font-weight: 600; color: #fff;">🍏 Diet Quality</div>
          <div style="font-size: 0.75rem; color: #39ff14; margin-top: 0.1rem;">Rating: ${dietVal}/5</div>
        </div>`;
    }

    coachAuditDisplayCard.innerHTML = cardHTML;
  }

  // 4. Connect Event Listener
  coachAuditDateSelect.addEventListener('change', (e) => {
    renderAuditDateDetails(e.target.value);
  });

  // Default: Display latest session immediately on load
  if (sortedDates.length > 0) {
    renderAuditDateDetails(sortedDates[0]);
  }
}

async function loadMessageCenterWidget(clientId) {
  console.log("Loading Message Center for:", clientId);
  const feed = document.getElementById('mainCommentFeed');
  if (!feed) return;

  feed.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Loading conversation...</p>';

  try {
    // Simple, clean select pointing directly to the new user_id column
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('user_id', clientId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      feed.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem;">Error loading messages.</p>';
      return;
    }

    feed.innerHTML = ''; // Clear loading state

    if (!comments || comments.length === 0) {
      feed.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1rem 0;">No messages yet. Send a message to start the conversation.</p>';
      return;
    }

    comments.forEach(comment => {
      appendSingleCommentToFeed(feed, comment);
    });

    feed.scrollTop = feed.scrollHeight;

  } catch (err) {
    console.error("Message Center failed:", err);
    feed.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem;">Error loading conversation.</p>';
  }
}



// Render dynamic customizable coach charts based on dropdown selection
// <--- THIS IS THE ONLY BRACKET THAT CLOSES THE FUNCTION

function getCommonChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: '#8a8f98' } }
    },
    scales: {
      x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8a8f98' } },
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8a8f98' } }
    }
  };
}

function drawEmptyChartPlaceholder(ctx, message) {
  const canvas = ctx;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#8a8f98';
  context.font = '13px -apple-system, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(message, canvas.width / 2, canvas.height / 2);
}

// Save status updates (suspend or closed/archived accounts)
if (athleteStatusSelect) {
  athleteStatusSelect.addEventListener('change', async (e) => {
    if (!activeClientId) return;
    const newStatus = e.target.value;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ client_status: newStatus })
        .eq('id', activeClientId);

      if (error) throw error;
      fetchRoster(); // Refresh status badges on Left column
    } catch (err) {
      alert("Could not update status: " + err.message);
    }
  });
}


// Fetch workout history logs of the inspected client
async function fetchAthleteHistory() {
  if (!activeClientId) return;

  const { data: workouts, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', activeClientId)
    .order('log_date', { ascending: false });

  if (error || !athleteHistoryGrid) return;

  athleteHistoryGrid.innerHTML = '';

  if (!workouts || workouts.length === 0) {
    athleteHistoryGrid.innerHTML = '<p style="color: var(--text-muted);">No logs found.</p>';
    return;
  }

  workouts.forEach(workout => {
    let logDetail = '';

    // Logic for readable CSV-style formatting
    if (workout.exercise_name === 'Daily Nutritional Matrix') {
      logDetail = `Diet Rating: <strong>${workout.metrics.diet_rating}/5</strong>`;
    } else if (workout.category === 'cardio') {
      logDetail = `${workout.metrics.sets?.[0]?.distance} miles in ${workout.metrics.sets?.[0]?.duration} mins`;
    } else if (workout.exercise_name !== 'Biometric Snapshot Engine') {
      logDetail = workout.metrics.sets?.map(s => `${s.reps}x${s.weight}lbs`).join(', ');
    } else {
      logDetail = `Weight: ${workout.metrics.weight} lbs | BMI: ${workout.metrics.bmi?.toFixed(1)}`;
    }

    const row = document.createElement('div');
    row.className = 'audit-log-row';
    row.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--accent-neon); font-weight: bold;">${workout.log_date}</span>
        <span style="color: var(--text-muted);">${workout.exercise_name}</span>
      </div>
      <div style="margin-top: 4px;">${logDetail}</div>
    `;
    athleteHistoryGrid.appendChild(row);
  });
}


document.addEventListener('click', async (e) => {
  // 1. Handle Comment Posting
  if (e.target.classList.contains('post-comment-btn')) {
    const workoutId = e.target.getAttribute('data-workout-id');
    const inputElement = document.getElementById(`inspectCommentInput-${workoutId}`);
    const message = inputElement.value.trim();



    if (!message) return;

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          workout_id: workoutId,
          sender_id: currentCoachId,
          message: message
        }])
        .select
        .single();

      if (error) throw error;

      inputElement.value = '';
      const feedContainer = document.getElementById(`inspectComments-${workoutId}`);
      if (feedContainer) {
        appendSingleCommentToFeed(feedContainer, data);
      }
    } catch (err) {
      alert("Failed to send comment: " + err.message);
    }
  }

  // 2. Handle Metric Buttons (The Fix: Set value BEFORE rendering)
  if (e.target.classList.contains('coach-metric-btn')) {
    const metricType = e.target.getAttribute('data-metric');

    // Update the dropdown so it reflects what you clicked
    // Update the dropdown so it reflects what you clicked
    if (coachChartSelector) {
      coachChartSelector.value = metricType;
      // Now render the chart based on the new value
      renderCoachChart();
    }
  }
});
// Dedicated Message Sender logic


// Real-Time Sync on Coach Dashboard
function setupRealtimeComments() {
  supabase
    .channel('public:coach_comments')
    .on('postgres_changes', { event: 'INSERT', table: 'comments' }, (payload) => {
      const commentFeed = document.getElementById(`inspectComments-${payload.new.workout_id}`);
      if (commentFeed) {
        appendSingleCommentToFeed(commentFeed, payload.new);
      }
    })
    .subscribe();
}

// Helper to render a comment bubble instantly
function appendSingleCommentToFeed(container, comment) {
  const isMe = comment.sender_id === currentCoachId;
  const bubble = document.createElement('div');
  bubble.className = isMe ? 'comment-bubble coach-comment' : 'comment-bubble';
  bubble.style.cssText = "margin-bottom: 0.5rem; padding: 0.4rem 0.6rem; border-radius: 4px; font-size: 0.8rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);";
  if (isMe) {
    bubble.style.borderColor = "rgba(57, 255, 20, 0.2)";
    bubble.style.backgroundColor = "rgba(57, 255, 20, 0.02)";
  }

  bubble.innerHTML = `
    <div style="font-weight: bold; color: ${isMe ? 'var(--accent-neon)' : '#ffffff'}; margin-bottom: 0.15rem;">
      ${isMe ? 'You (Coach)' : 'Athlete'}
    </div>
    <div style="color: var(--text-primary);">${comment.message}</div>
  `;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// TAB NAVIGATION VIEWS CONTROL
const tabButtons = document.querySelectorAll('.tab-nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetTabId = button.getAttribute('data-target');

    tabButtons.forEach(btn => {
      btn.classList.remove('active');
      btn.style.color = "var(--text-muted)";
    });

    button.classList.add('active');
    button.style.color = "#ffffff";

    tabContents.forEach(content => {
      content.classList.add('hidden');
      content.style.display = "none";
    });

    const activeContent = document.getElementById(targetTabId);
    if (activeContent) {
      activeContent.classList.remove('hidden');
      activeContent.style.display = "block";
    }
  });
});

// ... (your branding form listener and other static listeners)



function showBrandStatus(text, type) {
  if (!brandStatusMsg) return;
  brandStatusMsg.textContent = text;
  brandStatusMsg.className = "error-banner";
  brandStatusMsg.style.backgroundColor = type === "success" ? "rgba(57, 255, 20, 0.1)" : "rgba(239, 68, 68, 0.1)";
  brandStatusMsg.style.borderColor = type === "success" ? "rgba(57, 255, 20, 0.2)" : "rgba(239, 68, 68, 0.2)";
  brandStatusMsg.style.color = type === "success" ? "var(--accent-neon)" : "#ef4444";
  brandStatusMsg.classList.remove('hidden');
}

// Redirect coach to Stripe Payment checkout portal
function handleCoachStripeRedirect() {
  const checkoutUrl = `${STRIPE_PAYMENT_LINK}?client_reference_id=${currentCoachId}&prefilled_email=${encodeURIComponent(userEmailDisplay.textContent)}`;
  window.location.href = checkoutUrl;
}

if (restartCoachBtn) restartCoachBtn.addEventListener('click', handleCoachStripeRedirect);
if (coachUpgradeBtn) coachUpgradeBtn.addEventListener('click', handleCoachStripeRedirect);

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login/';
  });
}

function applyCoachBranding(coach) {
  if (!coach) return;

  if (coach.theme_primary_color) {
    document.documentElement.style.setProperty('--brand-primary', coach.theme_primary_color);
  }
  if (coach.theme_secondary_color) {
    document.documentElement.style.setProperty('--brand-hover', coach.theme_secondary_color);
  }
  if (coach.background_color) {
    document.documentElement.style.setProperty('--bg-main', coach.background_color);
  }

  if (coach.theme_mode === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }

  const logoEl = document.getElementById('logoElement');
  if (logoEl) {
    if (coach.logo_url) {
      logoEl.innerHTML = `<img src="${coach.logo_url}" alt="Logo" style="max-height: 40px; width: auto; object-fit: contain;">`;
    } else {
      logoEl.innerHTML = `<h2>🚀 ${coach.full_name || 'EliteTrack'}</h2>`;
    }
  }
}