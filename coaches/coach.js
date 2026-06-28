// coaches/coach.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase Configuration
const SUPABASE_URL = "https://eiiwcvxjtnzetkyjyudi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaXdjdnhqdG56ZXRreWp5dWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTUzNTYsImV4cCI6MjA5Nzg5MTM1Nn0.RXDV2M02Gkgd4GBK4LEz_GVSjr5wqtR27z_Q_EWyHxQ";
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_coach_payment_link";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const userEmailDisplay = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const athleteList = document.getElementById('athleteList');
const inviteLinkContainer = document.getElementById('inviteLinkContainer');

// Expiration banner
const coachExpirationBanner = document.getElementById('coachExpirationBanner');
const restartCoachBtn = document.getElementById('restartCoachBtn');
const coachUpgradeBtn = document.getElementById('coachUpgradeBtn');

// Inspector DOM targets
const inactiveInspector = document.getElementById('inactiveInspector');
const activeInspector = document.getElementById('activeInspector');
const inspectAthleteName = document.getElementById('inspectAthleteName');
const inspectAthleteEmail = document.getElementById('inspectAthleteEmail');
const athleteStatusSelect = document.getElementById('athleteStatusSelect');
const athleteHistoryGrid = document.getElementById('athleteHistoryGrid');

// Biometrics quick blocks
const inspectBiometricsBlock = document.getElementById('inspectBiometricsBlock');
const inspectBioWeight = document.getElementById('inspectBioWeight');
const inspectBioWaist = document.getElementById('inspectBioWaist');
const inspectBioCal = document.getElementById('inspectBioCal');

// Branding DOM targets
const brandForm = document.getElementById('brandForm');
const brandPrimaryColor = document.getElementById('brandPrimaryColor');
const brandSecondaryColor = document.getElementById('brandSecondaryColor');
const brandLogoUrl = document.getElementById('brandLogoUrl');
const brandPhone = document.getElementById('brandPhone');
const brandAddress = document.getElementById('brandAddress');
const brandStatusMsg = document.getElementById('brandStatusMsg');

let currentCoachId = null;
let activeClientId = null;
let activeClientEmail = null;

// Routing Security Guard: Only allow valid coaches in this directory
async function initCoachDashboard() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    window.location.href = '/login/';
    return;
  }

  currentCoachId = session.user.id;
  userEmailDisplay.textContent = session.user.email;

  // Retrieve coach's subscription status
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role, trial_ends_at, subscription_status, theme_primary_color, theme_secondary_color, logo_url, contact_phone, contact_address')
    .eq('id', currentCoachId)
    .single();

  if (profileErr || !profile) {
    window.location.href = '/login/';
    return;
  }

  if (profile.role !== 'coach') {
    // Client sneaked in -> bounce them out to client root
    window.location.href = '/';
    return;
  }

  // Check coach trial/billing expiration
  const trialEndsDate = new Date(profile.trial_ends_at);
  const now = new Date();
  const isPaid = profile.subscription_status === 'active';
  const isTrialActive = profile.subscription_status === 'trial' && (trialEndsDate >= now);

  if (!isPaid && !isTrialActive) {
    // Coach expired -> show lockout banner
    coachExpirationBanner.classList.remove('hidden');
    if (coachUpgradeBtn) coachUpgradeBtn.classList.add('hidden');
  } else {
    if (coachUpgradeBtn) coachUpgradeBtn.classList.remove('hidden');
  }

  // Populate invite referral link
  const inviteLink = `${window.location.origin}/signup/?coach=${currentCoachId}`;
  inviteLinkContainer.textContent = inviteLink;

  // Populate brand customization form inputs
  if (profile.theme_primary_color) brandPrimaryColor.value = profile.theme_primary_color;
  if (profile.theme_secondary_color) brandSecondaryColor.value = profile.theme_secondary_color;
  if (profile.logo_url) brandLogoUrl.value = profile.logo_url;
  if (profile.contact_phone) brandPhone.value = profile.contact_phone;
  if (profile.contact_address) brandAddress.value = profile.contact_address;

  // Fetch team roster
  fetchRoster();
  setupRealtimeComments();
}

// Fetch clients linked to this coach [cite: 99]
async function fetchRoster() {
  const { data: clients, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, client_status')
    .eq('coach_id', currentCoachId)
    .order('full_name', { ascending: true });

  if (error) {
    console.error("Roster query error:", error.message);
    return;
  }

  athleteList.innerHTML = '';

  if (!clients || clients.length === 0) {
    athleteList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No athletes signed up yet under your link.</p>';
    return;
  }

  clients.forEach(client => {
    const item = document.createElement('div');
    item.className = 'athlete-roster-item';
    if (activeClientId === client.id) item.classList.add('active');
    
    const statusText = client.client_status || 'active';

    item.innerHTML = `
      <div>
        <strong style="color: #fff; font-size: 0.9rem;">${client.full_name || 'Anonymous athlete'}</strong>
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">${client.email}</p>
      </div>
      <span class="roster-status-badge status-${statusText}">${statusText.toUpperCase()}</span>
    `;

    item.addEventListener('click', () => {
      document.querySelectorAll('.athlete-roster-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      inspectAthlete(client);
    });

    athleteList.appendChild(item);
  });
}

// Inspect specific athlete portfolio logs & metrics
async function inspectAthlete(client) {
  activeClientId = client.id;
  activeClientEmail = client.email;
  
  inactiveInspector.classList.add('hidden');
  activeInspector.classList.remove('hidden');

  inspectAthleteName.textContent = client.full_name || 'Anonymous athlete';
  inspectAthleteEmail.textContent = client.email;
  athleteStatusSelect.value = client.client_status || 'active';

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
    inspectBiometricsBlock.classList.remove('hidden');
    inspectBioWeight.textContent = bRec.metrics.weight || '-';
    inspectBioWaist.textContent = bRec.metrics.waist || '-';
    inspectBioCal.textContent = bRec.metrics.target_calories || '-';
  } else {
    inspectBiometricsBlock.classList.add('hidden');
  }

  fetchAthleteHistory();
}

// Save status updates (suspend or closed/archived accounts) [cite: 99]
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

// Fetch workout history logs of the inspected client
async function fetchAthleteHistory() {
  if (!activeClientId) return;

  const { data: workouts, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', activeClientId)
    .order('log_date', { ascending: false });

  if (error) {
    console.error("Athlete history logs query failed:", error.message);
    return;
  }

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
    if (workout.exercise_name === 'Biometric Snapshot Engine') return; // Skip biometrics rows

    const card = document.createElement('div');
    card.className = 'history-day-card';
    card.style.cssText = `background: #1c2742; border: 1px solid var(--border-subtle); border-radius: 8px; margin-bottom: 0.75rem; overflow: hidden;`;

    let innerSetsHTML = '';
    
    if (workout.exercise_name === 'Daily Nutritional Matrix') {
      innerSetsHTML = `<strong>Diet rating: ${workout.metrics.diet_rating}/5</strong>`;
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

    const displayTag = workout.exercise_name === 'Daily Nutritional Matrix' ? 'NUTRITION' : workout.category.toUpperCase().replace('_', ' ');

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

        <!-- Real-Time Workout Comments section -->
        <div class="workout-comments-feed">
          <div class="comments-list" id="inspectComments-${workout.id}" style="max-height: 120px; overflow-y: auto; margin-bottom: 0.5rem; display: flex; flex-direction: column;">
            <!-- Comments rendering -->
          </div>
          <div class="comment-input-row" style="display: flex; gap: 0.5rem;">
            <input type="text" id="inspectCommentInput-${workout.id}" placeholder="Type feedback message..." style="flex: 1; padding: 0.4rem; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-main); color: #fff; font-size: 0.8rem;">
            <button type="button" class="btn-primary post-comment-btn" data-workout-id="${workout.id}" style="padding: 0.4rem 1rem; font-size: 0.8rem; border-radius: 4px;">Comment</button>
          </div>
        </div>
      </div>
    `;

    // Populate comments instantly
    const feedContainer = card.querySelector('.comments-list');
    const workoutComments = commentsMap[workout.id] || [];
    workoutComments.forEach(comment => {
      appendSingleCommentToFeed(feedContainer, comment);
    });

    athleteHistoryGrid.appendChild(card);
  });
}

// Handle Posting comment replies
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

// Update Branding custom settings
brandForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  brandStatusMsg.className = "hidden";
  brandStatusMsg.textContent = "";

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

function showBrandStatus(text, type) {
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

restartCoachBtn.addEventListener('click', handleCoachStripeRedirect);
if (coachUpgradeBtn) {
  coachUpgradeBtn.addEventListener('click', handleCoachStripeRedirect);
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login/';
});

initCoachDashboard();