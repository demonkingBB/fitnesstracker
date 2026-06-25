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

// New Modular Form UI Targets
const cardioLoggingForm = document.getElementById('cardioLoggingForm');
const dietLoggingForm = document.getElementById('dietLoggingForm');

// Expiration / Upgrade Selectors
const trialExpirationBanner = document.getElementById('trialExpirationBanner');
const restartTrialBtn = document.getElementById('restartTrialBtn');
const smallUpgradeBtn = document.getElementById('smallUpgradeBtn');
const saveWorkoutBtn = document.getElementById('saveWorkoutBtn');

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

// Generate dynamic Weight Training Input Fields (Required Removed)
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
          <input type="number" placeholder="Reps" class="workout-input reps-input" style="width: 100px;" min="0" step="any">
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

// Manage dynamically appended training sets (Required Removed)
exerciseContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('add-set-btn')) {
    const exIndex = e.target.getAttribute('data-index');
    const container = document.getElementById(`setsContainer-${exIndex}`);
    const currentSetCount = container.children.length + 1;

    const setRow = document.createElement('div');
    setRow.className = "set-row";
    setRow.innerHTML = `
      <span>Set ${currentSetCount}</span>
      <input type="number" placeholder="Reps" class="workout-input reps-input" style="width: 100px;" min="0" step="any">
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

// PUSH WEIGHT TRAINING ONLY
// 🏋️ UNIVERSAL WEIGHT TRAINING & CALISTHENICS SUBMISSION
workoutLoggingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isTrialExpired) return showStatus("Trial expired.", "error");

  showStatus("", "");

  const selectedDay = programSelect.value; // 🚀 Automatically grabs "Push Day", "Upper Body", "Bro Split Day", etc.
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
        routine_focus: selectedDay, // 🚀 Saves the exact active split day into your new database column!
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
// 🏃 SAFELY LOG CARDIO SESSIONS
cardioLoggingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isTrialExpired) return showStatus("Trial expired.", "error");

  try {
    const durationVal = parseFloat(document.getElementById('cardioDuration').value);
    const distanceVal = parseFloat(document.getElementById('cardioDistance').value);
    
    // 🧠 Safety check: Fallback to a default string if your program dropdown variable is named differently
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
    
    if (typeof fetchAndRenderHistory === 'function') {
      fetchAndRenderHistory(selectedDay);
    }
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
      category: 'diet_rating',
      exercise_name: 'Daily Nutritional Matrix',
      routine_focus: selectedDay,
      metrics: { diet_rating: dietRating }
    }];

    const { error } = await supabase.from('workout_logs').insert(payload);
    if (error) throw error;
    
    showStatus("Diet metrics stored!", "success");
    document.querySelectorAll('.diet-btn').forEach(btn => btn.classList.remove('selected'));
    dietLoggingForm.reset();
    
    if (typeof fetchAndRenderHistory === 'function') {
      fetchAndRenderHistory(selectedDay);
    }
  } catch (err) {
    console.error("Diet save error details:", err);
    showStatus(`Diet save failure: ${err.message}`, "error");
  }
});

// COLLAPSIBLE PROGRESSIVE OVERLOAD DAILY SUMMARY MATRIX
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

  // Group logs together by standard calendar date
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

  let sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

  // Dynamic filter layer mapping matching left panel focus state
  if (selectedDayFilter && selectedDayFilter !== "") {
    const allowedExercises = PROGRAMS[selectedDayFilter] || [];
    
    // 🔍 DEBUG LOGS: Let's see what the dropdown clicked vs what's in your file
    console.log("Selected Dropdown Day:", selectedDayFilter);
    console.log("Allowed Exercises for this day from programdata.js:", allowedExercises);
    
    sortedDates = sortedDates.filter(dateKey => {
      const masterDayGroup = groupedByDate[dateKey];
      
      const matchingLifts = workouts.filter(log => {
        const isMatch = log.log_date === dateKey && 
                        log.category !== 'cardio' && 
                        log.category !== 'diet_rating' && 
                        allowedExercises.includes(log.exercise_name);
        
        // 🔍 DEBUG LOGS: See why a specific exercise is passing or failing
        if (log.log_date === dateKey && log.category !== 'cardio' && log.category !== 'diet_rating') {
          console.log(`Checking DB Exercise: "${log.exercise_name}" against allowed list. Match found?`, allowedExercises.includes(log.exercise_name));
        }
        
        return isMatch;
      });
      
      if (matchingLifts.length > 0) {
        masterDayGroup.lifts = matchingLifts;
        return true;
      }
      return false;
    });
  }

  // Hard cap to the latest 5 days to preserve perfect workspace aspect balance
  const latestDates = sortedDates.slice(0, 5);

  if (latestDates.length === 0) {
    historyGrid.innerHTML = `<p style="color: var(--text-muted); padding: 1rem;">No matching session logs target found for ${selectedDayFilter || 'this filter'}.</p>`;
    return;
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

    // 🏋️ COLLAPSIBLE EXERCISE-SPECIFIC PROGRESSIVE OVERLOAD MATRIX
    if (liftCount > 0) {
      const exercisesOnThisDay = {};
      
      dayGroup.lifts.forEach(workout => {
        if (!exercisesOnThisDay[workout.exercise_name]) {
          exercisesOnThisDay[workout.exercise_name] = [];
        }
        const setsData = Array.isArray(workout.metrics.sets) ? workout.metrics.sets : [];
        exercisesOnThisDay[workout.exercise_name].push(...setsData);
      });

      Object.keys(exercisesOnThisDay).forEach(exerciseName => {
        const allSetsForThisExercise = exercisesOnThisDay[exerciseName];
        
        let topLiftingSet = allSetsForThisExercise.reduce((max, current) => {
          if (!max) return current;
          if (current.weight > max.weight) return current;
          if (current.weight === max.weight && current.reps > max.reps) return current;
          return max;
        }, null);

        if (topLiftingSet) {
          detailsHTML += `
            <div style="margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.02);">
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${exerciseName}</div>
              <div style="font-size: 0.8rem; color: var(--accent-neon); font-weight: bold; margin-top: 0.1rem;">
                🔥 Target: ${topLiftingSet.weight} lbs/kg x ${topLiftingSet.reps} reps
              </div>
            </div>`;
        }
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

    dayCard.addEventListener('click', () => {
      const detailsBlock = dayCard.querySelector('.day-card-details');
      const isHidden = detailsBlock.classList.contains('hidden');
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

// ==========================================================================
// UNIVERSAL DASHBOARD INTERFACE VIEW CONTROLLER (TABS)
// ==========================================================================
const tabButtons = document.querySelectorAll('.tab-nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetTabId = button.getAttribute('data-target');

    // 1. Reset all navigation items to inactive state layout
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
      btn.style.color = "var(--text-muted)";
    });
    
    // 2. Set currently selected target tab to active styling
    button.classList.add('active');
    button.style.color = "#ffffff";

    // 3. Hide all tab panels completely from layout view
    tabContents.forEach(content => {
      content.classList.add('hidden');
      content.style.display = "none";
    });

    // 4. Reveal the targeted panel workspace cleanly
    const activeContent = document.getElementById(targetTabId);
    if (activeContent) {
      activeContent.classList.remove('hidden');
      activeContent.style.display = "block";
    }
  });
});

// ==========================================================================
// BIOMETRIC ENGINE MATH & PROGRESSIVE OVERLOAD VISUALS
// ==========================================================================
const biometricForm = document.getElementById('biometricForm');
const biometricResults = document.getElementById('biometricResults');
const biometricHistoryList = document.getElementById('biometricHistoryList');
let volumeChartInstance = null;

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

    // 🧮 1. BMI Calculation
    const bmi = (weightLbs / (heightInches * heightInches)) * 703;

    // 🧮 2. BMR Calculation (Mifflin-St Jeor Equation)
    const weightKg = weightLbs / 2.20462;
    const heightCm = heightInches * 2.54;
    let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
    bmr = (sex === "male") ? bmr + 5 : bmr - 161;

    // 🧮 3. TDEE Calculation
    const tdee = bmr * activityMultiplier;

    // 🧮 4. Waist-To-Hip Ratio
    const whr = waist / hips;

    // 🧮 5. Dynamic Diet Target Calorie Adjustments
    let targetCalories = Math.round(tdee);
    if (goal === 'loss') {
      targetCalories = Math.round(tdee - 500);
    } else if (goal === 'hypertrophy') {
      if (bmi < 18.5) {
        targetCalories = Math.round(tdee + 500); // Low BMI: Add 500
      } else if (bmi >= 18.5 && bmi < 25) {
        targetCalories = Math.round(tdee + 250); // Normal BMI: Add 250
      } else {
        targetCalories = Math.round(tdee); // High BMI: Recomp at baseline maintenance
      }
    }

    // 🏁 6. Determine Abdominal Obesity Risks
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

    // Paint Calculated Matrix safely onto user UI view
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

    // Pack Biometrics as a structured object and push directly to your workout_logs table!
    const todayDateString = new Date().toISOString().split('T')[0];
    const payload = [{
      user_id: currentUser.id,
      log_date: todayDateString,
      category: 'diet_rating', // Groups cleanly with nutritional compliance analytics
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
    } catch (err) {
      showStatus(`Biometric save failure: ${err.message}`, "error");
    }
  });
}

// Fetch and render calculated snapshots into historical scroll list
async function fetchAndRenderBiometricHistory() {
  if (!currentUser) return;
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

  // 🗓️ Calculate cutoff date based on the selector value
  const timeframeDays = parseInt(document.getElementById('chartTimeframe').value, 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);
  const cutoffDateString = cutoffDate.toISOString().split('T')[0];

  if (activeChartType === 'body') {
    // FETCH BODY SNAPSHOTS
    const { data: records, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('exercise_name', 'Biometric Snapshot Engine')
      .gte('log_date', cutoffDateString) // 🚀 Only fetch rows within our timeframe!
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
          { label: 'Weight (lbs)', data: weightData, borderColor: '#39ff14', backgroundColor: 'transparent', borderWidth: 2, tension: 0.2 },
          { label: 'Waist (in)', data: waistData, borderColor: '#00d2ff', backgroundColor: 'transparent', borderWidth: 2, tension: 0.2 },
          { label: 'BMI Target', data: bmiData, borderColor: '#ff9f43', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [5, 5], tension: 0.2 }
        ]
      },
      options: getCommonChartOptions(true)
    });

  } else {
    // FETCH WEIGHT TRAINING LOGS
    const { data: logs, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('category', 'weight_training')
      .gte('log_date', cutoffDateString) // 🚀 Only fetch rows within our timeframe!
      .order('log_date', { ascending: true });

    if (error || !logs || logs.length === 0) {
      drawEmptyChartPlaceholder(ctx, `No training volume logs in the last ${timeframeDays} days.`);
      return;
    }

    const volumeByDate = {};
    logs.forEach(log => {
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
          borderColor: '#39ff14',
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

// 🚀 EVENT LISTENER FOR THE TIMEFRAME DROPDOWN CHANGE
const timeframeSelect = document.getElementById('chartTimeframe');
if (timeframeSelect) {
  timeframeSelect.addEventListener('change', () => {
    renderAnalyticsChart();
  });
}

// ==========================================================================
// UNIFIED SWAPPABLE ANALYTICS GRAPH ENGINE
// ==========================================================================
let analyticsChartInstance = null;
let activeChartType = 'body'; // Default starting layout view

// Main function to query Supabase and draw the active graph mode
async function renderAnalyticsChart() {
  if (!currentUser) return;
  const ctx = document.getElementById('analyticsChart');
  if (!ctx) return;

  // Kill old chart instance completely to prevent hover ghosts
  if (analyticsChartInstance) {
    analyticsChartInstance.destroy();
  }

  if (activeChartType === 'body') {
    // 👤 MODE A: FETCH AND GRAPH SCALE WEIGHT, WAISTLINE & BMI HISTORY
    const { data: records, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('exercise_name', 'Biometric Snapshot Engine')
      .order('log_date', { ascending: true });

    if (error || !records || records.length === 0) {
      drawEmptyChartPlaceholder(ctx, "No biometric history entries saved yet.");
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
          {
            label: 'Weight (lbs)',
            data: weightData,
            borderColor: '#39ff14', // Gold or Neon Green
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: 'Waist (in)',
            data: waistData,
            borderColor: '#00d2ff', // Sleek Navy/Ice Blue accent
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: 'BMI Target',
            data: bmiData,
            borderColor: '#ff9f43', 
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [5, 5], // Dashed line for index targets
            tension: 0.2
          }
        ]
      },
      options: getCommonChartOptions(true)
    });

  } else {
    // 💪 MODE B: FETCH AND GRAPH PROGRESSIVE TRAINING VOLUME LOAD
    const { data: logs, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('category', 'weight_training')
      .order('log_date', { ascending: true });

    if (error || !logs || logs.length === 0) {
      drawEmptyChartPlaceholder(ctx, "No training logs saved yet.");
      return;
    }

    const volumeByDate = {};
    logs.forEach(log => {
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
          borderColor: '#39ff14',
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

// Chart Styling Presets Block
function getCommonChartOptions(showLegend) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { 
        display: showLegend,
        labels: { color: '#94a3b8', font: { size: 10 } }
      } 
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#94a3b8', font: { size: 9 } } },
      y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#94a3b8', font: { size: 9 } } }
    }
  };
}

function drawEmptyChartPlaceholder(ctx, message) {
  // Gracefully handles empty states instead of crashing Chart.js
  analyticsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels: [message], datasets: [] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
}

// Attach sub-nav click handlers to change active views instantly
document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.chart-toggle-btn').forEach(b => {
      b.classList.remove('active');
      b.style.background = "none";
      b.style.borderColor = "var(--border-subtle)";
      b.style.color = "var(--text-muted)";
    });

    btn.classList.add('active');
    btn.style.background = "rgba(57,255,20,0.1)";
    btn.style.borderColor = "#39ff14";
    btn.style.color = "#39ff14";

    activeChartType = btn.getAttribute('data-chart');
    renderAnalyticsChart();
  });
});

// Make sure analytics load on dashboard boot sequence
window.addEventListener('load', () => {
  fetchAndRenderBiometricHistory();
  renderVolumeOverloadChart();
});

//init//
initDashboard();