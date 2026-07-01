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
const coachChartSelector = document.getElementById('coachChartSelector');

let currentCoachId = null;
let activeClientId = null;
let coachChartInstance = null;

// --- CORE FUNCTIONS ---


async function fetchRoster() {
  const { data: clients, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, client_status')
    .eq('coach_id', currentCoachId)
    .order('full_name', { ascending: true });

  if (error || !athleteList) return;
  athleteList.innerHTML = clients?.length ? '' : '<p>No athletes found.</p>';
  clients?.forEach(client => {
    const item = document.createElement('div');
    item.className = 'athlete-roster-item';
    item.innerHTML = `<div><strong>${client.full_name}</strong><p>${client.email}</p></div>`;
    item.addEventListener('click', () => inspectAthlete(client));
    athleteList.appendChild(item);
  });
}

// --- INITIALIZATION ---

async function initCoachDashboard() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) { window.location.href = '/login/'; return; }

  currentCoachId = session.user.id;
  if (userEmailDisplay) userEmailDisplay.textContent = session.user.email;

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentCoachId)
    .single();

  if (profileErr || !profile || profile.role !== 'coach') { window.location.href = '/login/'; return; }

  applyCoachBranding(profile);
  
  // Expiration check
  const trialEndsDate = new Date(profile.trial_ends_at || Date.now());
  if (profile.subscription_status !== 'active' && trialEndsDate < new Date()) {
    if (coachExpirationBanner) coachExpirationBanner.classList.remove('hidden');
  }

  // Populate UI
  if (brandPrimaryColor) brandPrimaryColor.value = profile.theme_primary_color || '#39ff14';
  if (brandSecondaryColor) brandSecondaryColor.value = profile.theme_secondary_color || '#29d609';
  if (inviteLinkContainer) inviteLinkContainer.textContent = `${window.location.origin}/signup/?coach=${currentCoachId}`;

  await fetchRoster();
}

// --- START APP ---
document.addEventListener('DOMContentLoaded', initCoachDashboard);

// --- BRANDING FORM ---
if (brandForm) {
  brandForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Collect all values from your form
    const updates = {
      theme_primary_color: brandPrimaryColor.value,
      theme_secondary_color: brandSecondaryColor.value,
      logo_url: brandLogoUrl.value.trim() || null,
      contact_phone: brandPhone.value.trim() || null,
      contact_address: brandAddress.value.trim() || null
      // NOTE: If you add an "app_name" column to your 'profiles' table, 
      // you can simply add: app_name: document.getElementById('brandAppName').value
    };

    try {
      // 1. Update the database
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentCoachId);

      if (error) throw error;

      // 2. Apply theme changes instantly (Live Preview)
      applyCoachBranding({
        theme_primary_color: updates.theme_primary_color,
        theme_secondary_color: updates.theme_secondary_color
      });

      // 3. Optional: Update Title if you have an input for it
      // const titleInput = document.getElementById('brandAppName');
      // if (titleInput) document.title = titleInput.value;

      alert("Branding configurations updated successfully!");
    } catch (err) {
      alert("Failed to update configurations: " + err.message);
    }
  });
}

// ... (Add your existing inspectAthlete, renderCoachChart, fetchAthleteHistory, and comment logic below here)
// Inspect specific athlete portfolio logs & metrics
async function inspectAthlete(client) {
  activeClientId = client.id;
  activeClientEmail = client.email;
  
  if (inactiveInspector) inactiveInspector.classList.add('hidden');
  if (activeInspector) activeInspector.classList.remove('hidden');

  if (inspectAthleteName) inspectAthleteName.textContent = client.full_name || 'Anonymous athlete';
  if (inspectAthleteEmail) inspectAthleteEmail.textContent = client.email;
  if (athleteStatusSelect) athleteStatusSelect.value = client.client_status || 'active';

  // Load latest biometrics
  const { data: bRec } = await supabase
    .from('workout_logs')
    .select('metrics')
    .eq('user_id', activeClientId)
    .eq('exercise_name', 'Biometric Snapshot Engine')
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bRec && bRec.metrics) {
    if (inspectBiometricsBlock) inspectBiometricsBlock.classList.remove('hidden');
    if (inspectBioWeight) inspectBioWeight.textContent = bRec.metrics.weight || '-';
    if (inspectBioWaist) inspectBioWaist.textContent = bRec.metrics.waist || '-';
    if (inspectBioCal) inspectBioCal.textContent = bRec.metrics.target_calories || '-';
  } else {
    if (inspectBiometricsBlock) inspectBiometricsBlock.classList.add('hidden');
  }

  fetchAthleteHistory();
  renderCoachChart();
}

// Render dynamic customizable coach charts based on dropdown selection
async function renderCoachChart() {
  if (!activeClientId) return;
  const ctx = document.getElementById('coachAnalyticsChart');
  if (!ctx) return;

  if (coachChartInstance) coachChartInstance.destroy();

  const selectedChartType = coachChartSelector ? coachChartSelector.value : 'volume';

  if (selectedChartType === 'volume') {
    // 1. Plot Strength Volumes
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', activeClientId)
      .eq('category', 'weight_training')
      .order('log_date', { ascending: true });

    if (!logs || logs.length === 0) {
      drawEmptyChartPlaceholder(ctx, "No strength volume data available.");
      return;
    }

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
    // 2. Plot Cardio Outputs (Dual-axis Grouped metrics)
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', activeClientId)
      .eq('category', 'cardio')
      .order('log_date', { ascending: true });

    if (!logs || logs.length === 0) {
      drawEmptyChartPlaceholder(ctx, "No cardio history logs available.");
      return;
    }

    const labels = logs.map(l => l.log_date);
    const distanceData = logs.map(l => l.metrics?.sets?.[0]?.distance || 0);
    const durationData = logs.map(l => l.metrics?.sets?.[0]?.duration || 0);

    coachChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Distance (miles/km)', data: distanceData, borderColor: '#38bdf8', backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y' },
          { label: 'Duration (mins)', data: durationData, borderColor: '#f43f5e', backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } },
          y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } }
        }
      }
    });

  } else {
    // 3. Plot Behavioral Diagnostics (BMI vs. Diet Quality ratings side-by-side)
    const { data: bioLogs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', activeClientId)
      .eq('exercise_name', 'Biometric Snapshot Engine')
      .order('log_date', { ascending: true });

    const { data: dietLogs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', activeClientId)
      .eq('exercise_name', 'Daily Nutritional Matrix')
      .order('log_date', { ascending: true });

    if ((!bioLogs || bioLogs.length === 0) && (!dietLogs || dietLogs.length === 0)) {
      drawEmptyChartPlaceholder(ctx, "No metrics available for Diet comparisons.");
      return;
    }

    // Merge dates for accurate alignment
    const allDates = Array.from(new Set([
      ...bioLogs.map(b => b.log_date),
      ...dietLogs.map(d => d.log_date)
    ])).sort();

    const bmiByDate = {};
    bioLogs.forEach(b => bmiByDate[b.log_date] = b.metrics?.bmi || 0);

    const dietByDate = {};
    dietLogs.forEach(d => dietByDate[d.log_date] = d.metrics?.diet_rating || 0);

    const bmiData = allDates.map(date => bmiByDate[date] || null);
    const dietData = allDates.map(date => dietByDate[date] || null);

    coachChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allDates,
        datasets: [
          { label: 'BMI Progress', data: bmiData, borderColor: '#e11d48', backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y', spanGaps: true },
          { label: 'Diet Rating (1-5)', data: dietData, borderColor: '#39ff14', backgroundColor: 'rgba(57, 255, 20, 0.05)', borderWidth: 2, yAxisID: 'y1', spanGaps: true, fill: true, showLine: true }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'BMI Score', color: '#fff' } },
          y1: { type: 'linear', display: true, position: 'right', min: 1, max: 5, ticks: { stepSize: 1 }, title: { display: true, text: 'Diet Rating (1-5)', color: '#39ff14' }, grid: { drawOnChartArea: false } }
        }
      }
    });
  }
}

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

  if (error) {
    console.error("Athlete history query failed:", error.message);
    return;
  }

  if (!athleteHistoryGrid) return;
  athleteHistoryGrid.innerHTML = '';

  if (!workouts || workouts.length === 0) {
    athleteHistoryGrid.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">This athlete has not logged any workouts yet.</p>';
    return;
  }

  // Fetch comments linked to these workouts
  const workoutIds = workouts.map(w => w.id);
  let commentsMap = {};
  if (workoutIds.length > 0) {
    const { data: dbComments } = await supabase
      .from('comments')
      .select('*')
      .in('workout_id', workoutIds)
      .order('created_at', { ascending: true });

    if (dbComments) {
      dbComments.forEach(c => {
        if (!commentsMap[c.workout_id]) commentsMap[c.workout_id] = [];
        commentsMap[c.workout_id].push(c);
      });
    }
  }

  workouts.forEach(workout => {
    const card = document.createElement('div');
    card.className = 'history-day-card';
    card.style.cssText = `background: #1c2742; border: 1px solid var(--border-subtle); border-radius: 8px; margin-bottom: 0.75rem; overflow: hidden;`;

    let innerSetsHTML = '';
    
    if (workout.exercise_name === 'Daily Nutritional Matrix') {
      innerSetsHTML = `<strong>Diet Quality Rating: ${workout.metrics.diet_rating}/5</strong>`;
    } else if (workout.exercise_name === 'Biometric Snapshot Engine') {
      const m = workout.metrics;
      innerSetsHTML = `
        <div>Scale Weight: <strong>${m.weight}</strong> lbs | Waist: <strong>${m.waist}</strong>"</div>
        <div style="margin-top: 0.15rem;">BMI: <strong>${m.bmi ? m.bmi.toFixed(1) : '-'}</strong> | Daily TDEE Target: <strong>${Math.round(m.tdee)}</strong> kcal</div>
      `;
    } else if (workout.category === 'cardio') {
      const sets = Array.isArray(workout.metrics.sets) ? workout.metrics.sets : [];
      sets.forEach(item => {
        innerSetsHTML += `<div>Duration: ${item.duration} mins | Distance: ${item.distance} miles/km</div>`;
      });
    } else {
      const sets = Array.isArray(workout.metrics.sets) ? workout.metrics.sets : [];
      sets.forEach(item => {
        innerSetsHTML += `<div>Set ${item.set}: ${item.reps} reps @ ${item.weight} lbs/kg</div>`;
      });
    }

    const displayTag = workout.exercise_name === 'Daily Nutritional Matrix' 
      ? 'NUTRITION' 
      : (workout.exercise_name === 'Biometric Snapshot Engine' ? 'BIOMETRICS' : workout.category.toUpperCase().replace('_', ' '));

    card.innerHTML = `
      <div style="padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.01); border-bottom: 1px solid rgba(255,255,255,0.04);">
        <div>
          <span class="category-tag">${displayTag}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">${workout.log_date}</span>
        </div>
      </div>
      <div style="padding: 1rem;">
        <h4 style="color: #fff; margin-bottom: 0.5rem; font-size: 1rem;">${workout.exercise_name}</h4>
        <div style="font-size: 0.85rem; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
          ${innerSetsHTML}
        </div>
        <div class="workout-comments-feed">
          <div class="comments-list" id="inspectComments-${workout.id}" style="max-height: 120px; overflow-y: auto; margin-bottom: 0.5rem; display: flex; flex-direction: column;">
            <!-- Comments rendering -->
          </div>
          <div class="comment-input-row" style="display: flex; gap: 0.5rem;">
            <input type="text" id="inspectCommentInput-${workoutId = workout.id}" placeholder="Type feedback message..." style="flex: 1; padding: 0.4rem; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-main); color: #fff; font-size: 0.8rem;">
            <button type="button" class="btn-primary post-comment-btn" data-workout-id="${workout.id}" style="padding: 0.4rem 1rem; font-size: 0.8rem; border-radius: 4px;">Comment</button>
          </div>
        </div>
      </div>
    `;

    const feedContainer = card.querySelector('.comments-list');
    const workoutComments = commentsMap[workout.id] || [];
    workoutComments.forEach(comment => {
      appendSingleCommentToFeed(feedContainer, comment);
    });

    athleteHistoryGrid.appendChild(card);
  });
}


document.addEventListener('click', async (e) => {
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
        .select()
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
});

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

if (brandForm) {
  brandForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (brandStatusMsg) {
      brandStatusMsg.className = "hidden";
      brandStatusMsg.textContent = "";
    }

    const primary = brandPrimaryColor.value;
    const secondary = brandSecondaryColor.value;
    const logo = brandLogoUrl.value.trim();
    const phone = brandPhone.value.trim();
    const address = brandAddress.value.trim();

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          theme_primary_color: primary,
          theme_secondary_color: secondary,
          logo_url: logo ? logo : null,
          contact_phone: phone ? phone : null,
          contact_address: address ? address : null
        })
        .eq('id', currentCoachId);

      if (error) throw error;

      showBrandStatus("Brand configurations updated successfully!", "success");
    } catch (err) {
      showBrandStatus("Failed to update configurations: " + err.message, "error");
    }
  });
}

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
  if (coach.theme_primary_color) {
    document.documentElement.style.setProperty('--brand-primary', coach.theme_primary_color);
  }
  if (coach.theme_secondary_color) {
    document.documentElement.style.setProperty('--brand-hover', coach.theme_secondary_color);
  }
}