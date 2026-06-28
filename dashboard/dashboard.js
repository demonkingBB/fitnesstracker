// dashboard/dashboard.js
import { PROGRAMS, ROUTINES } from './programdata.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase Configuration
const SUPABASE_URL = "https://eiiwcvxjtnzetkyjyudi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaXdjdnhqdG56ZXRreWp5dWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTUzNTYsImV4cCI6MjA5Nzg5MTM1Nn0.RXDV2M02Gkgd4GBK4LEz_GVSjr5wqtR27z_Q_EWyHxQ";
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_your_payment_link_id"; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const userEmailDisplay = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const routineSelect = document.getElementById('routineSelect');
const programSelectGroup = document.getElementById('programSelectGroup');
const programSelect = document.getElementById('programSelect');
const workoutLoggingForm = document.getElementById('workoutLoggingForm');
const exerciseContainer = document.getElementById('exerciseContainer');
const statusMsg = document.getElementById('statusMsg');
const historyGrid = document.getElementById('historyGrid');
const noHistoryMsg = document.getElementById('noHistoryMsg');

// Modular Form UI Targets
const cardioLoggingForm = document.getElementById('cardioLoggingForm');
const dietLoggingForm = document.getElementById('dietLoggingForm');

// Expiration / Upgrade Selectors
const trialExpirationBanner = document.getElementById('trialExpirationBanner');
const restartTrialBtn = document.getElementById('restartTrialBtn');
const smallUpgradeBtn = document.getElementById('smallUpgradeBtn');
const saveWorkoutBtn = document.getElementById('saveWorkoutBtn');

// Coach Branding and Card selectors
const logoElement = document.getElementById('logoElement');
const coachContactWrapper = document.getElementById('coachContactWrapper');
const contactCoachBtn = document.getElementById('contactCoachBtn');
const coachContactCard = document.getElementById('coachContactCard');
const coachCardName = document.getElementById('coachCardName');
const coachCardEmail = document.getElementById('coachCardEmail');
const coachCardPhone = document.getElementById('coachCardPhone');
const coachCardAddress = document.getElementById('coachCardAddress');

let currentUser = null;
let isTrialExpired = false;
let activeCoachProfile = null;

// Initialize Session, Check Expiration and Load Preferences
async function initDashboard() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    window.location.href = '/login/';
    return;
  }

  currentUser = session.user;
  userEmailDisplay.textContent = currentUser.email;

  // Retrieve user profile configuration details
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, current_program_id, trial_ends_at, subscription_status, coach_id, client_status')
    .eq('id', currentUser.id)
    .single();

  if (!profileError && profile) {
    if (profile.role === 'coach') {
      window.location.href = '/coaches/';
      return;
    }

    // MULTI-TENANT ACCESS ENGINE
    if (profile.coach_id) {
      // 1. Fetch coach profile to check both their active status and branding data
      const { data: coach, error: coachError } = await supabase
        .from('profiles')
        .select('full_name, email, contact_phone, contact_address, theme_primary_color, theme_secondary_color, logo_url, subscription_status, trial_ends_at')
        .eq('id', profile.coach_id)
        .single();

      if (!coachError && coach) {
        activeCoachProfile = coach;
        applyCoachBranding(coach);

        const coachTrialEnds = new Date(coach.trial_ends_at);
        const now = new Date();
        const isCoachExpired = coach.subscription_status !== 'active' && (coachTrialEnds < now);

        if (isCoachExpired) {
          isTrialExpired = true;
          trialExpirationBanner.classList.remove('hidden');
          trialExpirationBanner.querySelector('h4').textContent = "Coaching Group Inactive";
          trialExpirationBanner.querySelector('p').textContent = "Your coach's account is currently inactive. Logging is temporarily restricted.";
          if (smallUpgradeBtn) smallUpgradeBtn.classList.add('hidden');
          restartTrialBtn.classList.add('hidden');
          lockLoggingInputs('Coaching Account Suspended');
        } else if (profile.client_status === 'suspended' || profile.client_status === 'closed') {
          isTrialExpired = true;
          trialExpirationBanner.classList.remove('hidden');
          trialExpirationBanner.querySelector('h4').textContent = "Access Restricted";
          trialExpirationBanner.querySelector('p').textContent = "Your coach has suspended your logging privileges. You can still view your history below.";
          if (smallUpgradeBtn) smallUpgradeBtn.classList.add('hidden');
          restartTrialBtn.classList.add('hidden');
          lockLoggingInputs('Account Suspended by Coach');
        } else {
          isTrialExpired = false;
          trialExpirationBanner.classList.add('hidden');
        }
      }
    } else {
      // 2. Client is independent (No coach) -> Default 4-week trial check
      const trialEndsDate = new Date(profile.trial_ends_at);
      const now = new Date();
      const isPaid = profile.subscription_status === 'active';
      const isTrialActive = profile.subscription_status === 'trial' && (trialEndsDate >= now);

      if (isPaid) {
        isTrialExpired = false;
        if (smallUpgradeBtn) smallUpgradeBtn.classList.add('hidden');
        trialExpirationBanner.classList.add('hidden');
      } else if (isTrialActive) {
        isTrialExpired = false;
        if (smallUpgradeBtn) smallUpgradeBtn.classList.remove('hidden');
        trialExpirationBanner.classList.add('hidden');
      } else {
        isTrialExpired = true;
        if (smallUpgradeBtn) smallUpgradeBtn.classList.add('hidden');
        trialExpirationBanner.classList.remove('hidden');
        lockLoggingInputs('Trial Expired - Sign Up Required');
      }
    }
  }

  // Populate Program Selection Dropdown
  routineSelect.innerHTML = '<option value="">-- Select Your Overall Program Split --</option>';
  Object.keys(ROUTINES).forEach(routineKey => {
    const option = document.createElement('option');
    option.value = routineKey;
    option.textContent = routineKey;
    routineSelect.appendChild(option);
  });

  // Load Saved Program from Database Memory if available
  if (profile && profile.current_program_id) {
    const { data: programObj } = await supabase
      .from('programs')
      .select('name')
      .eq('id', profile.current_program_id)
      .single();

    if (programObj && ROUTINES[programObj.name]) {
      routineSelect.value = programObj.name;
      populateSubDays(programObj.name);
    }
  }

  setupDietRatingListeners();
  setupContactCardListeners();
  fetchAndRenderHistory();
  fetchAndRenderBiometricHistory();
  renderAnalyticsChart();
  setupRealtimeComments();
}

function lockLoggingInputs(buttonMessage) {
  saveWorkoutBtn.disabled = true;
  saveWorkoutBtn.style.opacity = '0.5';
  saveWorkoutBtn.textContent = buttonMessage;

  const cardioSubmit = cardioLoggingForm.querySelector('button[type="submit"]');
  if (cardioSubmit) {
    cardioSubmit.disabled = true;
    cardioSubmit.style.opacity = '0.5';
    cardioSubmit.textContent = 'Cardio Locked';
  }
  const dietSubmit = dietLoggingForm.querySelector('button[type="submit"]');
  if (dietSubmit) {
    dietSubmit.disabled = true;
    dietSubmit.style.opacity = '0.5';
    dietSubmit.textContent = 'Diet Logging Locked';
  }
}

// Apply Dynamic Coach Branding properties to document styles
function applyCoachBranding(coach) {
  if (coach.theme_primary_color) {
    document.documentElement.style.setProperty('--accent-neon', coach.theme_primary_color);
  }
  if (coach.theme_secondary_color) {
    document.documentElement.style.setProperty('--accent-hover', coach.theme_secondary_color);
  }

  if (coach.logo_url && logoElement) {
    logoElement.innerHTML = `<img src="${coach.logo_url}" alt="${coach.full_name}" style="max-height: 40px; width: auto; object-fit: contain;">`;
  } else if (logoElement) {
    logoElement.innerHTML = `<h2>🚀 ${coach.full_name || 'Coach'} Track</h2>`;
  }

  if (coachContactWrapper) {
    coachContactWrapper.classList.remove('hidden');
    coachCardName.textContent = coach.full_name || 'Your Coach';
    coachCardEmail.textContent = coach.email || 'N/A';
    coachCardPhone.textContent = coach.contact_phone || 'N/A';
    coachCardAddress.textContent = coach.contact_address || 'Virtual coaching';
  }
}

// Toggle Contact dropcard on Header click
function setupContactCardListeners() {
  if (!contactCoachBtn || !coachContactCard) return;
  contactCoachBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    coachContactCard.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    coachContactCard.classList.add('hidden');
  });

  coachContactCard.addEventListener('click', (e) => e.stopPropagation());
}

// Populate Child sub-days matching the selected overall Routine split
function populateSubDays(routineName) {
  if (!routineName) {
    programSelectGroup.classList.add('hidden');
    workoutLoggingForm.classList.add('hidden');
    return;
  }

  programSelectGroup.classList.remove('hidden');
  programSelect.innerHTML = '<option value="">-- Choose Today\'s Focus Day --</option>';

  const subDays = ROUTINES[routineName];
  subDays.forEach(day => {
    const option = document.createElement('option');
    option.value = day;
    option.textContent = day;
    programSelect.appendChild(option);
  });
}

// Watch parent Routine changes
routineSelect.addEventListener('change', async (e) => {
  const selectedRoutine = e.target.value;
  
  populateSubDays(selectedRoutine);
  workoutLoggingForm.classList.add('hidden');
  exerciseContainer.innerHTML = '';

  if (selectedRoutine && currentUser) {
    const { data: globalProg } = await supabase
      .from('programs')
      .select('id')
      .eq('name', selectedRoutine)
      .maybeSingle();

    if (globalProg) {
      await supabase
        .from('profiles')
        .update({ current_program_id: globalProg.id })
        .eq('id', currentUser.id);
    }
  }
});

// Watch child sub-day changes to paint input fields AND filter history sidebar
programSelect.addEventListener('change', (e) => {
  const selectedDay = e.target.value;
  generateExerciseForm(selectedDay);
  fetchAndRenderHistory(selectedDay);
});

// Generate dynamic Weight Training Input Fields
function generateExerciseForm(selectedDay) {
  if (!selectedDay) {
    workoutLoggingForm.classList.add('hidden');
    return;
  }

  workoutLoggingForm.classList.remove('hidden');
  exerciseContainer.innerHTML = '';

  const exerciseList = PROGRAMS[selectedDay] || [];

  exerciseList.forEach((exerciseName, exIndex) => {
    const exerciseWrapper = document.createElement('div');
    exerciseWrapper.className = 'exercise-log-block';
    exerciseWrapper.setAttribute('data-exercise-name', exerciseName);

    exerciseWrapper.innerHTML = `
      <h4 style="margin-bottom: 1rem; color: var(--text-primary); font-size: 1.1rem;">${exIndex + 1}. ${exerciseName}</h4>
      <div class="sets-list-container" id="setsContainer-${exIndex}">
        <div class="set-row">
          <span>Set 1</span>
          <input type="number" placeholder="Reps" class="workout-input reps-input" style="width: 100px;" min="0">
          <input type="number" placeholder="lbs / kg" class="workout-input weight-input" style="width: 110px;" min="0" step="any">
        </div>
      </div>
      <button type="button" class="btn-secondary add-set-btn" data-index="${exIndex}" style="padding: 4px 12px; font-size: 0.8rem; margin-top: 0.5rem;">
        + Add Extra Set
      </button>
    `;
    exerciseContainer.appendChild(exerciseWrapper);
  });
}

// Manage dynamically appended training sets
exerciseContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('add-set-btn')) {
    const exIndex = e.target.getAttribute('data-index');
    const container = document.getElementById(`setsContainer-${exIndex}`);
    const currentSetCount = container.children.length + 1;

    const setRow = document.createElement('div');
    setRow.className = "set-row";
    setRow.innerHTML = `
      <span>Set ${currentSetCount}</span>
      <input type="number" placeholder="Reps" class="workout-input reps-input" style="width: 100px;" min="0">
      <input type="number" placeholder="lbs / kg" class="workout-input weight-input" style="width: 110px;" min="0" step="any">
    `;
    container.appendChild(setRow);
  }
});

// Configure Diet Radio Group selections visual classes
function setupDietRatingListeners() {
  const container = document.getElementById('dietRatingSelector');
  if (!container) return;
  const labels = container.querySelectorAll('.diet-btn');

  labels.forEach(label => {
    label.addEventListener('click', () => {
      labels.forEach(l => l.classList.remove('selected'));
      label.classList.add('selected');
    });
  });
}

// 🏋️ UNIVERSAL WEIGHT TRAINING & CALISTHENICS SUBMISSION
workoutLoggingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isTrialExpired) return showStatus("Trial expired.", "error");

  showStatus("", "");

  const selectedDay = programSelect.value; 
  const blocks = document.querySelectorAll('.exercise-log-block');
  const payloadRows = [];
  const todayDateString = new Date().toISOString().split('T')[0];

  blocks.forEach(block => {
    const exName = block.getAttribute('data-exercise-name');
    const setRows = block.querySelectorAll('.set-row');
    const structuredSetsArray = [];

    setRows.forEach((row, rowIndex) => {
      const repsVal = parseInt(row.querySelector('.reps-input').value, 10);
      const weightVal = parseFloat(row.querySelector('.weight-input').value);

      if (!isNaN(repsVal) && !isNaN(weightVal)) {
        structuredSetsArray.push({
          set: rowIndex + 1,
          reps: repsVal,
          weight: weightVal
        });
      }
    });

    if (structuredSetsArray.length > 0) {
      let logCategory = 'weight_training';
      if (selectedDay === "Calisthenics" || selectedDay.toLowerCase().includes("calisthenics")) {
        logCategory = 'calisthenics';
      }

      payloadRows.push({
        user_id: currentUser.id,
        log_date: todayDateString,
        category: logCategory,
        exercise_name: exName,
        routine_focus: selectedDay, 
        metrics: { sets: structuredSetsArray }
      });
    }
  });

  if (payloadRows.length === 0) {
    showStatus("Please fill out at least one exercise step to submit progress.", "error");
    return;
  }

  try {
    const { error } = await supabase.from('workout_logs').insert(payloadRows);
    if (error) throw error;
    showStatus("Success! Progress saved.", "success");
    workoutLoggingForm.reset();
    workoutLoggingForm.classList.add('hidden');
    fetchAndRenderHistory(selectedDay);
  } catch (err) {
    showStatus(`Failed to save: ${err.message}`, "error");
  }
});

// 🏃 UNIVERSAL CARDIO SUBMISSION
cardioLoggingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isTrialExpired) return showStatus("Trial expired.", "error");

  try {
    const durationVal = parseFloat(document.getElementById('cardioDuration').value);
    const distanceVal = parseFloat(document.getElementById('cardioDistance').value);
    
    const activeDropdown = document.getElementById('programSelect') || document.getElementById('routineSelect');
    const selectedDay = activeDropdown ? activeDropdown.value : "Cardio Session";

    if (isNaN(durationVal) || isNaN(distanceVal)) {
      showStatus("Please complete both Cardio metrics before saving.", "error");
      return;
    }

    const todayDateString = new Date().toISOString().split('T')[0];
    const payload = [{
      user_id: currentUser.id,
      log_date: todayDateString,
      category: 'cardio',
      exercise_name: 'Cardio Session',
      routine_focus: selectedDay,
      metrics: {
        sets: [{ set: 1, duration: durationVal, distance: distanceVal }]
      }
    }];

    const { error } = await supabase.from('workout_logs').insert(payload);
    if (error) throw error;
    
    showStatus("Cardio milestone recorded!", "success");
    cardioLoggingForm.reset();
    fetchAndRenderHistory(selectedDay);
  } catch (err) {
    console.error("Cardio save error details:", err);
    showStatus(`Cardio save failure: ${err.message}`, "error");
  }
});

// 🍏 SAFELY LOG DAILY DIET RATINGS
dietLoggingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isTrialExpired) return showStatus("Trial expired.", "error");

  try {
    const selectedDietInput = document.querySelector('input[name="dietRating"]:checked');
    const activeDropdown = document.getElementById('programSelect') || document.getElementById('routineSelect');
    const selectedDay = activeDropdown ? activeDropdown.value : "Nutrition Logging";

    if (!selectedDietInput) {
      showStatus("Please pick a rating value from 1 to 5.", "error");
      return;
    }

    const dietRating = parseInt(selectedDietInput.value, 10);
    const todayDateString = new Date().toISOString().split('T')[0];
    const payload = [{
      user_id: currentUser.id,
      log_date: todayDateString,
      category: 'weight_training', 
      exercise_name: 'Daily Nutritional Matrix',
      routine_focus: selectedDay,
      metrics: { diet_rating: dietRating }
    }];

    const { error } = await supabase.from('workout_logs').insert(payload);
    if (error) throw error;
    
    showStatus("Diet metrics stored!", "success");
    document.querySelectorAll('.diet-btn').forEach(btn => btn.classList.remove('selected'));
    dietLoggingForm.reset();
    fetchAndRenderHistory(selectedDay);
  } catch (err) {
    console.error("Diet save error details:", err);
    showStatus(`Diet save failure: ${err.message}`, "error");
  }
});

// Realtime Comments Listener
function setupRealtimeComments() {
  if (!currentUser) return;
  
  supabase
    .channel('public:comments')
    .on('postgres_changes', { event: 'INSERT', table: 'comments' }, (payload) => {
      const commentFeed = document.getElementById(`commentsList-${payload.new.workout_id}`);
      if (commentFeed) {
        appendSingleCommentToFeed(commentFeed, payload.new);
      }
    })
    .subscribe();
}

// Helper to render a comment bubble instantly
function appendSingleCommentToFeed(container, comment) {
  const isCoach = comment.sender_id !== currentUser.id;
  const bubble = document.createElement('div');
  bubble.className = isCoach ? 'comment-bubble coach-comment' : 'comment-bubble';
  bubble.style.cssText = "margin-bottom: 0.5rem; padding: 0.4rem 0.6rem; border-radius: 4px; font-size: 0.8rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);";
  if (isCoach) {
    bubble.style.borderColor = "rgba(57, 255, 20, 0.2)";
    bubble.style.backgroundColor = "rgba(57, 255, 20, 0.02)";
  }
  
  bubble.innerHTML = `
    <div style="font-weight: bold; color: ${isCoach ? 'var(--accent-neon)' : '#ffffff'}; margin-bottom: 0.15rem;">
      ${isCoach ? 'Coach Feedback' : 'You'}
    </div>
    <div style="color: var(--text-primary);">${comment.message}</div>
  `;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// COLLAPSIBLE PROGRESSIVE OVERLOAD SUMMARY MATRIX
async function fetchAndRenderHistory(selectedDayFilter = null) {
  const { data: workouts, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('log_date', { ascending: false });

  if (error) {
    console.error("Historical retrieval failure: ", error.message);
    return;
  }

  historyGrid.innerHTML = '';

  if (!workouts || workouts.length === 0) {
    noHistoryMsg.style.display = 'block';
    historyGrid.appendChild(noHistoryMsg);
    return;
  }

  noHistoryMsg.style.display = 'none';

  const groupedByDate = {};
  workouts.forEach(log => {
    if (!groupedByDate[log.log_date]) {
      groupedByDate[log.log_date] = {
        date: log.log_date,
        lifts: [],
        cardio: null,
        diet: null
      };
    }
    
    if (log.category === 'cardio') {
      groupedByDate[log.log_date].cardio = log;
    } else if (log.exercise_name === 'Daily Nutritional Matrix') {
      groupedByDate[log.log_date].diet = log;
    } else if (log.exercise_name !== 'Biometric Snapshot Engine') {
      groupedByDate[log.log_date].lifts.push(log);
    }
  });

  let sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

  if (selectedDayFilter && selectedDayFilter !== "") {
    const allowedExercises = PROGRAMS[selectedDayFilter] || [];
    
    sortedDates = sortedDates.filter(dateKey => {
      const masterDayGroup = groupedByDate[dateKey];
      
      const matchingLifts = workouts.filter(log => {
        return log.log_date === dateKey && 
               log.category !== 'cardio' && 
               log.exercise_name !== 'Daily Nutritional Matrix' && 
               log.exercise_name !== 'Biometric Snapshot Engine' && 
               allowedExercises.includes(log.exercise_name);
      });
      
      if (matchingLifts.length > 0) {
        masterDayGroup.lifts = matchingLifts;
        return true;
      }
      return false;
    });
  }

  const latestDates = sortedDates.slice(0, 5);

  if (latestDates.length === 0) {
    historyGrid.innerHTML = `<p style="color: var(--text-muted); padding: 1rem;">No matching logs found for ${selectedDayFilter || 'this filter'}.</p>`;
    return;
  }

  const workoutIdsOnScreen = workouts.filter(w => latestDates.includes(w.log_date)).map(w => w.id);
  let commentsByWorkout = {};
  if (workoutIdsOnScreen.length > 0) {
    const { data: dbComments } = await supabase
      .from('comments')
      .select('*')
      .in('workout_id', workoutIdsOnScreen)
      .order('created_at', { ascending: true });

    if (dbComments) {
      dbComments.forEach(c => {
        if (!commentsByWorkout[c.workout_id]) commentsByWorkout[c.workout_id] = [];
        commentsByWorkout[c.workout_id].push(c);
      });
    }
  }

  latestDates.forEach(dateStr => {
    const dayGroup = groupedByDate[dateStr];
    const dayCard = document.createElement('div');
    dayCard.className = 'history-day-card';
    dayCard.style.cssText = `background: #111a2e; border: 1px solid var(--border-subtle); border-radius: 8px; margin-bottom: 0.75rem; overflow: hidden; cursor: pointer; transition: all 0.2s ease;`;

    const dietVal = dayGroup.diet?.metrics?.diet_rating || null;
    const liftCount = dayGroup.lifts.length;
    const cardioLogged = dayGroup.cardio ? "🏃 Cardio" : "";
    
    const headerHTML = `
      <div class="day-card-header" style="padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
        <div>
          <span style="font-weight: 700; color: #ffffff; font-size: 0.95rem;">${dateStr}</span>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
            ${liftCount > 0 ? `🏋️ ${liftCount} Lifts` : ''} ${cardioLogged}
          </div>
        </div>
        ${dietVal ? `<span style="font-size: 0.75rem; background: rgba(57, 255, 20, 0.1); color: #39ff14; padding: 4px 8px; border-radius: 4px; font-weight: bold;">🍏 Diet: ${dietVal}/5</span>` : '<span style="color:var(--text-muted); font-size:0.8rem;">▼</span>'}
      </div>
    `;

    let detailsHTML = `<div class="day-card-details hidden" style="padding: 1rem; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.15);">`;

    if (liftCount > 0) {
      dayGroup.lifts.forEach(workout => {
        const setsData = Array.isArray(workout.metrics.sets) ? workout.metrics.sets : [];
        let setsString = '';
        setsData.forEach(item => {
          setsString += `Set ${item.set}: ${item.reps} reps @ ${item.weight} lbs/kg | `;
        });

        detailsHTML += `
          <div style="margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 0.85rem; font-weight: bold; color: var(--text-primary);">${workout.exercise_name}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">${setsString.slice(0, -3)}</div>
            
            <div class="workout-comments-feed">
              <div class="comments-list" id="commentsList-${workout.id}" style="max-height: 150px; overflow-y: auto; margin-bottom: 0.5rem; display: flex; flex-direction: column;">
                <!-- Comments populated here -->
              </div>
              <div class="comment-input-row" style="display: flex; gap: 0.5rem;">
                <input type="text" id="commentInput-${workout.id}" placeholder="Type a message to your coach..." style="flex: 1; padding: 0.4rem; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-main); color: #fff; font-size: 0.8rem;">
                <button type="button" class="btn-primary post-comment-btn" data-workout-id="${workout.id}" style="padding: 0.4rem 1rem; font-size: 0.8rem; border-radius: 4px;">Send</button>
              </div>
            </div>
          </div>`;
      });
    }

    if (dayGroup.cardio) {
      const cardioSets = Array.isArray(dayGroup.cardio.metrics.sets) ? dayGroup.cardio.metrics.sets : [];
      const topCardio = cardioSets[0] || { duration: 0, distance: 0 };
      detailsHTML += `
        <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
          <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">🏃 Cardio Session</div>
          <div style="font-size: 0.8rem; color: #38bdf8;">${topCardio.distance} miles/km in ${topCardio.duration} mins</div>
        </div>`;
    }

    detailsHTML += `</div>`;
    dayCard.innerHTML = headerHTML + detailsHTML;

    dayCard.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

      const detailsBlock = dayCard.querySelector('.day-card-details');
      const isHidden = detailsBlock.classList.contains('hidden');
      document.querySelectorAll('.day-card-details').forEach(el => el.classList.add('hidden'));
      
      if (isHidden) {
        detailsBlock.classList.remove('hidden');
        dayCard.style.borderColor = "var(--accent-neon)";

        if (liftCount > 0) {
          dayGroup.lifts.forEach(workout => {
            const feedContainer = document.getElementById(`commentsList-${workout.id}`);
            if (feedContainer) {
              feedContainer.innerHTML = '';
              const workoutComments = commentsByWorkout[workout.id] || [];
              workoutComments.forEach(comment => {
                appendSingleCommentToFeed(feedContainer, comment);
              });
            }
          });
        }

      } else {
        detailsBlock.classList.add('hidden');
        dayCard.style.borderColor = "var(--border-subtle)";
      }
    });

    historyGrid.appendChild(dayCard);
  });
}

// Handle Comment Posting
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('post-comment-btn')) {
    const workoutId = e.target.getAttribute('data-workout-id');
    const inputElement = document.getElementById(`commentInput-${workoutId}`);
    const message = inputElement.value.trim();

    if (!message) return;

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          workout_id: workoutId,
          sender_id: currentUser.id,
          message: message
        }])
        .select()
        .single();

      if (error) throw error;

      inputElement.value = '';
      const feedContainer = document.getElementById(`commentsList-${workoutId}`);
      if (feedContainer) {
        appendSingleCommentToFeed(feedContainer, data);
      }
    } catch (err) {
      alert("Failed to send comment: " + err.message);
    }
  }
});

// ==========================================================================
// BIOMETRIC ENGINE MATH & PROGRESSIVE OVERLOAD VISUALS
// ==========================================================================
const biometricForm = document.getElementById('biometricForm');
const biometricResults = document.getElementById('biometricResults');
const biometricHistoryList = document.getElementById('biometricHistoryList');

// Handle Biometric Computations Form Submission
if (biometricForm) {
  biometricForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isTrialExpired) return showStatus("Trial expired.", "error");

    const sex = document.getElementById('bioSex').value;
    const age = parseInt(document.getElementById('bioAge').value, 10);
    const weightLbs = parseFloat(document.getElementById('bioWeight').value);
    const heightInches = parseFloat(document.getElementById('bioHeight').value);
    const waist = parseFloat(document.getElementById('bioWaist').value);
    const hips = parseFloat(document.getElementById('bioHips').value);
    const activityMultiplier = parseFloat(document.getElementById('bioActivity').value);
    const goal = document.getElementById('bioGoal').value;

    const bmi = (weightLbs / (heightInches * heightInches)) * 703;

    const weightKg = weightLbs / 2.20462;
    const heightCm = heightInches * 2.54;
    let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
    bmr = (sex === "male") ? bmr + 5 : bmr - 161;

    const tdee = bmr * activityMultiplier;

    const whr = waist / hips;

    let targetCalories = Math.round(tdee);
    if (goal === 'loss') {
      targetCalories = Math.round(tdee - 500);
    } else if (goal === 'hypertrophy') {
      if (bmi < 18.5) {
        targetCalories = Math.round(tdee + 500); 
      } else if (bmi >= 18.5 && bmi < 25) {
        targetCalories = Math.round(tdee + 250); 
      } else {
        targetCalories = Math.round(tdee); 
      }
    }

    let riskText = "Low Abdominal Risk";
    let riskColor = "rgba(57, 255, 20, 0.15)";
    let fontColor = "#39ff14";

    if (sex === "male" && whr >= 0.90) {
      riskText = "Increased Abdominal Obesity Risk (WHR ≥ 0.90)";
      riskColor = "rgba(239, 68, 68, 0.15)";
      fontColor = "#ef4444";
    } else if (sex === "female" && whr >= 0.85) {
      riskText = "Increased Abdominal Obesity Risk (WHR ≥ 0.85)";
      riskColor = "rgba(239, 68, 68, 0.15)";
      fontColor = "#ef4444";
    }

    document.getElementById('resBMI').textContent = bmi.toFixed(1);
    document.getElementById('resBMR').textContent = `${Math.round(bmr)} kcal`;
    document.getElementById('resTDEE').textContent = `${Math.round(tdee)} kcal`;
    document.getElementById('resWHR').textContent = whr.toFixed(2);
    
    const riskContainer = document.getElementById('resRisk');
    riskContainer.textContent = riskText;
    riskContainer.style.backgroundColor = riskColor;
    riskContainer.style.color = fontColor;

    document.getElementById('resDietTarget').textContent = `${targetCalories} Calories / day`;
    biometricResults.classList.remove('hidden');

    const todayDateString = new Date().toISOString().split('T')[0];
    const payload = [{
      user_id: currentUser.id,
      log_date: todayDateString,
      category: 'weight_training', 
      exercise_name: 'Biometric Snapshot Engine',
      routine_focus: programSelect.value || 'Biometrics Log',
      metrics: {
        bmi: bmi, bmr: bmr, tdee: tdee, whr: whr, target_calories: targetCalories, weight: weightLbs, waist: waist
      }
    }];

    try {
      const { error } = await supabase.from('workout_logs').insert(payload);
      if (error) throw error;
      showStatus("Biometrics logged successfully!", "success");
      fetchAndRenderBiometricHistory();
      renderAnalyticsChart();
    } catch (err) {
      showStatus(`Biometric save failure: ${err.message}`, "error");
    }
  });
}

// Fetch and render calculated snapshots into historical scroll list
async function fetchAndRenderBiometricHistory() {
  if (!currentUser) return;
  const biometricHistoryList = document.getElementById('biometricHistoryList');
  if (!biometricHistoryList) return;

  const { data: records, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('exercise_name', 'Biometric Snapshot Engine')
    .order('log_date', { ascending: false });

  if (error || !records || records.length === 0) return;

  biometricHistoryList.innerHTML = '';
  records.forEach(rec => {
    const m = rec.metrics;
    const logItem = document.createElement('div');
    logItem.style.cssText = "background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.6rem; border-radius: 4px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;";
    logItem.innerHTML = `
      <div>
        <strong style="color:#ffffff;">${rec.log_date}</strong> 
        <span style="color:var(--text-muted); margin-left: 0.5rem;">Scale: ${m.weight} lbs | Waist: ${m.waist}"</span>
      </div>
      <span style="color: var(--accent-neon); font-weight: bold;">Target: ${m.target_calories} cal</span>
    `;
    biometricHistoryList.appendChild(logItem);
  });
}

// ==========================================================================
// TIME-AWARE SWAPPABLE ANALYTICS GRAPH ENGINE
// ==========================================================================
let analyticsChartInstance = null;
let activeChartType = 'body'; 

async function renderAnalyticsChart() {
  if (!currentUser) return;
  const ctx = document.getElementById('analyticsChart');
  if (!ctx) return;

  if (analyticsChartInstance) {
    analyticsChartInstance.destroy();
  }

  const timeframeDays = parseInt(document.getElementById('chartTimeframe').value, 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);
  const cutoffDateString = cutoffDate.toISOString().split('T')[0];

  if (activeChartType === 'body') {
    const { data: records, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('exercise_name', 'Biometric Snapshot Engine')
      .gte('log_date', cutoffDateString) 
      .order('log_date', { ascending: true });

    if (error || !records || records.length === 0) {
      drawEmptyChartPlaceholder(ctx, `No biometric history in the last ${timeframeDays} days.`);
      return;
    }

    const labels = records.map(r => r.log_date);
    const weightData = records.map(r => r.metrics?.weight || 0);
    const waistData = records.map(r => r.metrics?.waist || 0);
    const bmiData = records.map(r => r.metrics?.bmi || 0);

    analyticsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Weight (lbs)', data: weightData, borderColor: getComputedColor('--accent-neon', '#39ff14'), backgroundColor: 'transparent', borderWidth: 2, tension: 0.2 },
          { label: 'Waist (in)', data: waistData, borderColor: '#00d2ff', backgroundColor: 'transparent', borderWidth: 2, tension: 0.2 },
          { label: 'BMI Target', data: bmiData, borderColor: '#ff9f43', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [5, 5], tension: 0.2 }
        ]
      },
      options: getCommonChartOptions(true)
    });

  } else {
    const { data: logs, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('category', 'weight_training')
      .gte('log_date', cutoffDateString) 
      .order('log_date', { ascending: true });

    if (error || !logs || logs.length === 0) {
      drawEmptyChartPlaceholder(ctx, `No training volume logs in the last ${timeframeDays} days.`);
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

    analyticsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Object.keys(volumeByDate),
        datasets: [{
          label: 'Accumulated Volume (lbs)',
          data: Object.values(volumeByDate),
          borderColor: getComputedColor('--accent-neon', '#39ff14'),
          backgroundColor: 'rgba(57, 255, 20, 0.03)',
          borderWidth: 2,
          tension: 0.25,
          fill: true
        }]
      },
      options: getCommonChartOptions(false)
    });
  }
}

function getComputedColor(variableName, fallbackColor) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return value || fallbackColor;
}

function getCommonChartOptions(isBody) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: '#8a8f98',
          font: { family: '-apple-system, sans-serif', size: 11 }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#8a8f98', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#8a8f98', font: { size: 10 } }
      }
    }
  };
}

function drawEmptyChartPlaceholder(ctx, message) {
  const canvas = ctx;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#8a8f98';
  context.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(message, canvas.width / 2, canvas.height / 2);
}

const timeframeSelect = document.getElementById('chartTimeframe');
if (timeframeSelect) {
  timeframeSelect.addEventListener('change', () => {
    renderAnalyticsChart();
  });
}

document.addEventListener('click', function (e) {
  if (e.target && e.target.classList.contains('chart-toggle-btn')) {
    e.preventDefault();

    document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.style.background = "none";
      btn.style.borderColor = "var(--border-subtle)";
      btn.style.color = "var(--text-muted)";
    });

    e.target.classList.add('active');
    const computedAccent = getComputedColor('--accent-neon', '#39ff14');
    e.target.style.background = "rgba(57,255,20,0.1)";
    e.target.style.borderColor = computedAccent;
    e.target.style.color = computedAccent;

    activeChartType = e.target.getAttribute('data-chart');
    renderAnalyticsChart();
  }
});

function showStatus(text, type) {
  if (!text) {
    statusMsg.className = "hidden";
    return;
  }
  statusMsg.textContent = text;
  statusMsg.className = "error-banner";
  statusMsg.style.backgroundColor = type === "success" ? "rgba(57, 255, 20, 0.1)" : "rgba(239, 68, 68, 0.1)";
  statusMsg.style.borderColor = type === "success" ? "rgba(57, 255, 20, 0.2)" : "rgba(239, 68, 68, 0.2)";
  statusMsg.style.color = type === "success" ? "var(--accent-neon)" : "#ef4444";
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login/';
});

initDashboard();