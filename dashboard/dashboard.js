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

// Expiration / Upgrade Selectors
const trialExpirationBanner = document.getElementById('trialExpirationBanner');
const restartTrialBtn = document.getElementById('restartTrialBtn');
const smallUpgradeBtn = document.getElementById('smallUpgradeBtn');
const saveWorkoutBtn = document.getElementById('saveWorkoutBtn');

// Independent Form Selectors
const cardioLoggingForm = document.getElementById('cardioLoggingForm');
const dietLoggingForm = document.getElementById('dietLoggingForm');

let currentUser = null;
let isTrialExpired = false;

// Initialize Session, Check Expiration and Load Preferences
async function initDashboard() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    window.location.href = '/login/';
    return;
  }

  currentUser = session.user;
  userEmailDisplay.textContent = currentUser.email;

  // Check if returning from a successful Stripe checkout session
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('checkout') === 'success') {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ subscription_status: 'active' })
      .eq('id', currentUser.id);

    if (!updateError) {
      alert("Payment successful! Welcome to the EliteTrack program.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      console.error("Could not update profile to active:", updateError.message);
    }
  }

  // Retrieve user trial configuration details
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('current_program_id, trial_ends_at, subscription_status')
    .eq('id', currentUser.id)
    .single();

  if (!profileError && profile) {
    const trialEndsDate = new Date(profile.trial_ends_at);
    const now = new Date();

    const isPaid = profile.subscription_status === 'active';
    const isTrialActive = profile.subscription_status === 'trial' && (trialEndsDate >= now);

    if (isPaid) {
      isTrialExpired = false;
      smallUpgradeBtn.classList.add('hidden');
      trialExpirationBanner.classList.add('hidden');
    } else if (isTrialActive) {
      isTrialExpired = false;
      smallUpgradeBtn.classList.remove('hidden');
      trialExpirationBanner.classList.add('hidden');
    } else {
      isTrialExpired = true;
      smallUpgradeBtn.classList.add('hidden');
      trialExpirationBanner.classList.remove('hidden');
      
      saveWorkoutBtn.disabled = true;
      saveWorkoutBtn.style.opacity = '0.5';
      saveWorkoutBtn.textContent = 'Trial Expired - Sign Up Required';
    }
  }

  // Render Parent Routine Selector options
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
  fetchAndRenderHistory();
}

// Populate Child sub-days matching the selected overall Routine split (No Cardio)
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
  
  // Clear layout fields
  populateSubDays(selectedRoutine);
  workoutLoggingForm.classList.add('hidden');
  exerciseContainer.innerHTML = '';

  // Persist updated Routine Choice directly to Supabase Profile table
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

// Watch child sub-day changes to paint input fields AND filter history
programSelect.addEventListener('change', (e) => {
  const selectedDay = e.target.value;
  generateExerciseForm(selectedDay);
  
  // 🚀 NEW: Pass the selected day (e.g., "Push Day") to filter the sidebar!
  fetchAndRenderHistory(selectedDay);
});

// Generate dynamic Input Fields (Weight training and Calisthenics reps/weights)
function generateExerciseForm(selectedDay) {
  if (!selectedDay) {
    workoutLoggingForm.classList.add('hidden');
    return;
  }

  workoutLoggingForm.classList.remove('hidden');
  exerciseContainer.innerHTML = '';

  const exerciseList = PROGRAMS[selectedDay];

  exerciseList.forEach((exerciseName, exIndex) => {
    const exerciseWrapper = document.createElement('div');
    exerciseWrapper.className = 'exercise-log-block';
    exerciseWrapper.setAttribute('data-exercise-name', exerciseName);

    exerciseWrapper.innerHTML = `
      <h4 style="margin-bottom: 1rem; color: var(--text-primary); font-size: 1.1rem;">${exIndex + 1}. ${exerciseName}</h4>
      <div class="sets-list-container" id="setsContainer-${exIndex}">
        <div class="set-row">
          <span>Set 1</span>
          <input type="number" placeholder="Reps" class="workout-input reps-input" style="width: 100px;" required min="0">
          <input type="number" placeholder="lbs / kg" class="workout-input weight-input" style="width: 110px;" required min="0" step="any">
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
      <input type="number" placeholder="Reps" class="workout-input reps-input" style="width: 100px;" required min="0">
      <input type="number" placeholder="lbs / kg" class="workout-input weight-input" style="width: 110px;" required min="0" step="any">
    `;
    container.appendChild(setRow);
  }
});

// Configure Diet Radio Group selections
function setupDietRatingListeners() {
  const container = document.getElementById('dietRatingSelector');
  const labels = container.querySelectorAll('.diet-btn');

  labels.forEach(label => {
    label.addEventListener('click', () => {
      labels.forEach(l => l.classList.remove('selected'));
      label.classList.add('selected');
    });
  });
}

// Submit Module 1: Workout Splitting (Completely removes cardio and diet payloads)
workoutLoggingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isTrialExpired) {
    showStatus("Your trial has expired. You must sign up to submit logs.", "error");
    return;
  }

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
      const logCategory = (selectedDay === "Calisthenics") ? "calisthenics" : "weight_training";

      payloadRows.push({
        user_id: currentUser.id,
        log_date: todayDateString,
        category: logCategory,
        exercise_name: exName,
        metrics: {
          sets: structuredSetsArray
        }
      });
    }
  });

  if (payloadRows.length === 0) {
    showStatus("Please fill out at least one exercise set before saving.", "error");
    return;
  }

  try {
    const { error } = await supabase
      .from('workout_logs')
      .insert(payloadRows);

    if (error) throw error;

    showStatus("Success! Workout saved.", "success");
    workoutLoggingForm.reset();
    workoutLoggingForm.classList.add('hidden');
    fetchAndRenderHistory();

  } catch (err) {
    showStatus(`Failed to save: ${err.message}`, "error");
  }
});

// Submit Module 2: Independent Cardio Logging
cardioLoggingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isTrialExpired) {
    showStatus("Trial expired. Please sign up to track cardio.", "error");
    return;
  }

  showStatus("", "");

  const durationVal = parseFloat(document.getElementById('cardioDuration').value);
  const distanceVal = parseFloat(document.getElementById('cardioDistance').value);

  if (isNaN(durationVal) || isNaN(distanceVal)) {
    showStatus("Please fill out both duration and distance.", "error");
    return;
  }

  const todayDateString = new Date().toISOString().split('T')[0];
  const payload = [{
    user_id: currentUser.id,
    log_date: todayDateString,
    category: 'cardio',
    exercise_name: 'Cardio Session',
    metrics: {
      sets: [{ set: 1, duration: durationVal, distance: distanceVal }]
    }
  }];

  try {
    const { error } = await supabase.from('workout_logs').insert(payload);
    if (error) throw error;
    
    showStatus("Success! Cardio metrics recorded.", "success");
    cardioLoggingForm.reset();
    fetchAndRenderHistory();
  } catch (err) {
    showStatus(`Cardio save failure: ${err.message}`, "error");
  }
});

// Submit Module 3: Independent Daily Diet Rating
dietLoggingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isTrialExpired) {
    showStatus("Trial expired. Please sign up to record diet logs.", "error");
    return;
  }

  showStatus("", "");

  const selectedDietInput = document.querySelector('input[name="dietRating"]:checked');
  if (!selectedDietInput) {
    showStatus("Please choose a rating from 1 to 5.", "error");
    return;
  }

  const dietRating = parseInt(selectedDietInput.value, 10);
  const todayDateString = new Date().toISOString().split('T')[0];

  // Note: category must stay inside check constraints ('weight_training' is used to avoid DB insertion failures)
  const payload = [{
    user_id: currentUser.id,
    log_date: todayDateString,
    category: 'weight_training',
    exercise_name: 'Daily Nutritional Matrix',
    metrics: { 
      diet_rating: dietRating 
    }
  }];

  try {
    const { error } = await supabase.from('workout_logs').insert(payload);
    if (error) throw error;
    
    showStatus("Success! Daily diet rating stored.", "success");
    document.querySelectorAll('.diet-btn').forEach(btn => btn.classList.remove('selected'));
    dietLoggingForm.reset();
    fetchAndRenderHistory();
  } catch (err) {
    showStatus(`Diet save failure: ${err.message}`, "error");
  }
});

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

  // 1. GROUP LOGS BY DATE
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
    } else if (log.category === 'diet_rating') {
      groupedByDate[log.log_date].diet = log;
    } else {
      groupedByDate[log.log_date].lifts.push(log);
    }
  });

  // 2. CONVERT TO ARRAY AND LIMIT TO THE LATEST 5 DAYS
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));
  const latestDates = sortedDates.slice(0, 5); // 💡 Hard limit to 5 days max length

  latestDates.forEach(dateStr => {
    const dayGroup = groupedByDate[dateStr];
    
    // Create the main wrapper card
    const dayCard = document.createElement('div');
    dayCard.className = 'history-day-card';
    dayCard.style.cssText = `
      background: #111a2e;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      margin-bottom: 0.75rem;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Extract values for the summary preview line
    const dietVal = dayGroup.diet?.metrics?.diet_rating || null;
    const liftCount = dayGroup.lifts.length;
    const cardioLogged = dayGroup.cardio ? "🏃 Cardio" : "";
    
    // Beautiful Header Row (The Summary Preview)
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

    // Hidden Details Body (Expands when clicked)
    let detailsHTML = `<div class="day-card-details hidden" style="padding: 1rem; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.15);">`;

    // Populate Lifts inside the expansion panel
    if (liftCount > 0) {
      dayGroup.lifts.forEach(workout => {
        const setsData = Array.isArray(workout.metrics.sets) ? workout.metrics.sets : [];
        let topLiftingSet = setsData.reduce((max, current) => {
          if (!max) return current;
          if (current.weight > max.weight) return current;
          if (current.weight === max.weight && current.reps > max.reps) return current;
          return max;
        }, null);

        if (topLiftingSet) {
          detailsHTML += `
            <div style="margin-bottom: 0.75rem;">
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${workout.exercise_name}</div>
              <div style="font-size: 0.8rem; color: var(--accent-neon); font-weight: bold; margin-top: 0.1rem;">
                🔥 PR Target: ${topLiftingSet.weight} lbs/kg x ${topLiftingSet.reps} reps
              </div>
            </div>
          `;
        }
      });
    }

    // Populate Cardio inside expansion panel
    if (dayGroup.cardio) {
      const cardioSets = Array.isArray(dayGroup.cardio.metrics.sets) ? dayGroup.cardio.metrics.sets : [];
      const topCardio = cardioSets[0] || { duration: 0, distance: 0 };
      detailsHTML += `
        <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
          <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">🏃 Cardio Session</div>
          <div style="font-size: 0.8rem; color: #38bdf8;">${topCardio.distance} miles/km in ${topCardio.duration} mins</div>
        </div>
      `;
    }

    if (liftCount === 0 && !dayGroup.cardio) {
      detailsHTML += `<div style="font-size: 0.8rem; color: var(--text-muted);">Only nutritional info saved for this date.</div>`;
    }

    detailsHTML += `</div>`;

    // Stitch together and append
    dayCard.innerHTML = headerHTML + detailsHTML;

    // 3. ADD CLICK INTERACTION TO EXPAND/COLLAPSE
    dayCard.addEventListener('click', () => {
      const detailsBlock = dayCard.querySelector('.day-card-details');
      const isHidden = detailsBlock.classList.contains('hidden');
      
      // Close all other open history blocks first to maintain size constraints
      document.querySelectorAll('.day-card-details').forEach(el => el.classList.add('hidden'));
      
      if (isHidden) {
        detailsBlock.classList.remove('hidden');
        dayCard.style.borderColor = "var(--accent-neon)";
      } else {
        detailsBlock.classList.add('hidden');
        dayCard.style.borderColor = "var(--border-subtle)";
      }
    });

    historyGrid.appendChild(dayCard);
  });
}
      
  else {
    noHistoryMsg.style.display = 'block';
    historyGrid.innerHTML = '';
    historyGrid.appendChild(noHistoryMsg);
  }
}

// Redirect client to Stripe Payment checkout portal
function handleStripeRedirect() {
  if (!currentUser) return;
  const checkoutUrl = `${STRIPE_PAYMENT_LINK}?client_reference_id=${currentUser.id}&prefilled_email=${encodeURIComponent(currentUser.email)}`;
  window.location.href = checkoutUrl;
}

restartTrialBtn.addEventListener('click', handleStripeRedirect);
if (smallUpgradeBtn) {
  smallUpgradeBtn.addEventListener('click', handleStripeRedirect);
}

function showStatus(text, type) {
  if (!text) {
    statusMsg.className = "hidden";
    return;
  }
  statusMsg.textContent = text;
  statusMsg.className = "error-banner";
  statusMsg.style.backgroundColor = type === "success" ? "rgba(57, 255, 20, 0.1)" : "rgba(239, 68, 68, 0.1)";
  statusMsg.style.borderColor = type === "success" ? "rgba(57, 255, 20, 0.2)" : "rgba(239, 68, 68, 0.2)";
  statusMsg.style.color = type === "success" ? "#39ff14" : "#ef4444";
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login/';
});

initDashboard();