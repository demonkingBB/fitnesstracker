// dashboard/dashboard.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

// Supabase Configuration
const SUPABASE_URL = "https://eiiwcvxjtnzetkyjyudi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaXdjdnhqdG56ZXRreWp5dWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTUzNTYsImV4cCI6MjA5Nzg5MTM1Nn0.RXDV2M02Gkgd4GBK4LEz_GVSjr5wqtR27z_Q_EWyHxQ";
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_your_payment_link_id"; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PROGRAMS = {
  "Push Day": [
    "Barbell Bench Press", "Incline Dumbbell Press", "Overhead Press", 
    "Dumbbell Lateral Raise", "Cable Fly", "Chest Dip", 
    "Triceps Pushdown", "Skull Crushers", "Push-Up", "Machine Chest Press"
  ],
  "Pull Day": [
    "Pull-Up", "Lat Pulldown", "Barbell Row", "Seated Cable Row", 
    "Face Pull", "Dumbbell Curl", "Hammer Curl", "Rear Delt Fly", 
    "Chest-Supported Row", "Straight-Arm Pulldown"
  ],
  "Leg Day": [
    "Back Squat", "Front Squat", "Romanian Deadlift", "Leg Press", 
    "Walking Lunge", "Leg Extension", "Leg Curl", "Calf Raise", 
    "Hip Thrust", "Bulgarian Split Squat"
  ],
  "Upper Body Day": [
    "Bench Press", "Pull-Up", "Overhead Press", "Barbell Row", 
    "Incline Dumbbell Press", "Seated Cable Row", "Lateral Raise", 
    "Triceps Extension", "Biceps Curl", "Face Pull"
  ],
  "Lower Body Day": [
    "Back Squat", "Deadlift", "Leg Press", "Romanian Deadlift", 
    "Walking Lunge", "Leg Extension", "Leg Curl", "Calf Raise", 
    "Hip Thrust", "Bulgarian Split Squat"
  ],
  "Total Body Day": [
    "Deadlift", "Front Squat", "Bench Press", "Pull-Up", 
    "Overhead Press", "Barbell Row", "Kettlebell Swing", 
    "Farmer Carry", "Push Press", "Goblet Squat"
  ],
  "Calisthenics": [
    "Push-Up", "Pull-Up", "Dip", "Bodyweight Squat", 
    "Walking Lunge", "Plank", "Hollow Hold", "Inverted Row", 
    "Pike Push-Up", "Mountain Climber"
  ],
  "Chest-Biceps Day": [
    "Chest Press", "Incline Chest Press", "Chest Fly", "DB Chest Press", 
    "Overhead Press", "Cable Curls", "DB Curls", 
    "DB Hammer Curls", "Barbell Curls"
  ],
  "Back-Triceps Day": [
    "Bent Over Row", "Lat Pulldown", "Back Row", "DB Row", 
    "Rear Delt Fly", "Tricep Press Down", "OH Tricep Press", 
    "DB Tricep Kickbacks", "Tricep Dips"
  ],
  "Leg-Quad-Dom Day": [
    "Squat", "Leg Press", "Hack Squat", "Lunges", 
    "Leg Extensions", "Hip Abductor"
  ],
  "Leg-Ham-Dom Day": [
    "Stiff Leg Deadlift", "Dead Lift", "Seated Leg Curl", "Prone Leg Curl", 
    "Step Ups", "Hip Adductor", "Wide leg far leg press"
  ]
};

const ROUTINES = {
  "Push Pull Legs": ["Push Day", "Pull Day", "Leg Day"],
  "Upper Lower Body": ["Upper Body Day", "Lower Body Day"],
  "Bro Split": ["Chest-Biceps Day", "Back-Triceps Day", "Leg-Quad-Dom Day", "Leg-Ham-Dom Day"],
  "Total Body & Calisthenics": ["Total Body Day", "Calisthenics"]
};

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

const strengthPRContainer = document.getElementById('strengthPRContainer');
const cardioPRContainer = document.getElementById('cardioPRContainer');

let currentUser = null;
let isTrialExpired = false;
let activeCoachProfile = null;
let cachedWorkouts = [];
let strengthPRs = {};
let cardioPR = { distance: 0, duration: 0 };

// Initialize Session, Check Expiration and Load Preferences
async function initDashboard() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    window.location.href = '/login/';
    return;
  }

  currentUser = session.user;
  if (userEmailDisplay) {
    userEmailDisplay.textContent = currentUser.email;
  }

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
          if (trialExpirationBanner) {
            trialExpirationBanner.classList.remove('hidden');
            trialExpirationBanner.querySelector('h4').textContent = "Coaching Group Inactive";
            trialExpirationBanner.querySelector('p').textContent = "Your coach's account is currently inactive. Logging is temporarily restricted.";
          }
          if (smallUpgradeBtn) smallUpgradeBtn.classList.add('hidden');
          if (restartTrialBtn) restartTrialBtn.classList.add('hidden');
          lockLoggingInputs('Coaching Account Suspended');
        } else if (profile.client_status === 'suspended' || profile.client_status === 'closed') {
          isTrialExpired = true;
          if (trialExpirationBanner) {
            trialExpirationBanner.classList.remove('hidden');
            trialExpirationBanner.querySelector('h4').textContent = "Access Restricted";
            trialExpirationBanner.querySelector('p').textContent = "Your coach has suspended your logging privileges. You can still view your history below.";
          }
          if (smallUpgradeBtn) smallUpgradeBtn.classList.add('hidden');
          if (restartTrialBtn) restartTrialBtn.classList.add('hidden');
          lockLoggingInputs('Account Suspended by Coach');
        } else {
          isTrialExpired = false;
          if (trialExpirationBanner) trialExpirationBanner.classList.add('hidden');
        }
      }
    } else {
      const trialEndsDate = new Date(profile.trial_ends_at);
      const now = new Date();
      const isPaid = profile.subscription_status === 'active';
      const isTrialActive = profile.subscription_status === 'trial' && (trialEndsDate >= now);

      if (isPaid) {
        isTrialExpired = false;
        if (smallUpgradeBtn) smallUpgradeBtn.classList.add('hidden');
        if (trialExpirationBanner) trialExpirationBanner.classList.add('hidden');
      } else if (isTrialActive) {
        isTrialExpired = false;
        if (smallUpgradeBtn) smallUpgradeBtn.classList.remove('hidden');
        if (trialExpirationBanner) trialExpirationBanner.classList.add('hidden');
      } else {
        isTrialExpired = true;
        if (smallUpgradeBtn) smallUpgradeBtn.classList.add('hidden');
        if (trialExpirationBanner) trialExpirationBanner.classList.remove('hidden');
        lockLoggingInputs('Trial Expired - Sign Up Required');
      }
    }
  }

  // Populate Program Selection Dropdown
  if (routineSelect) {
    routineSelect.innerHTML = '<option value="">-- Select Your Overall Program Split --</option>';
    Object.keys(ROUTINES).forEach(routineKey => {
      const option = document.createElement('option');
      option.value = routineKey;
      option.textContent = routineKey;
      routineSelect.appendChild(option);
    });
  }

  // Load Saved Program from Database Memory if available
  if (profile && profile.current_program_id) {
    const { data: programObj } = await supabase
      .from('programs')
      .select('name')
      .eq('id', profile.current_program_id)
      .single();

    if (programObj && ROUTINES[programObj.name]) {
      if (routineSelect) routineSelect.value = programObj.name;
      populateSubDays(programObj.name);
    }
  }

  setupDietRatingListeners();
  setupContactCardListeners();
  await fetchWorkoutCache();
  fetchAndRenderHistory();
  fetchAndRenderBiometricHistory();
  renderAnalyticsChart();
  setupRealtimeComments();
}

function lockLoggingInputs(buttonMessage) {
  if (saveWorkoutBtn) {
    saveWorkoutBtn.disabled = true;
    saveWorkoutBtn.style.opacity = '0.5';
    saveWorkoutBtn.textContent = buttonMessage;
  }
  if (cardioLoggingForm) {
    const cardioSubmit = cardioLoggingForm.querySelector('button[type="submit"]');
    if (cardioSubmit) {
      cardioSubmit.disabled = true;
      cardioSubmit.style.opacity = '0.5';
      cardioSubmit.textContent = 'Cardio Locked';
    }
  }
  if (dietLoggingForm) {
    const dietSubmit = dietLoggingForm.querySelector('button[type="submit"]');
    if (dietSubmit) {
      dietSubmit.disabled = true;
      dietSubmit.style.opacity = '0.5';
      dietSubmit.textContent = 'Diet Logging Locked';
    }
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
    if (coachCardName) coachCardName.textContent = coach.full_name || 'Your Coach';
    if (coachCardEmail) coachCardEmail.textContent = coach.email || 'N/A';
    if (coachCardPhone) coachCardPhone.textContent = coach.contact_phone || 'N/A';
    if (coachCardAddress) coachCardAddress.textContent = coach.contact_address || 'Virtual coaching';
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

// Cache all user logs on startup to process PR targets and cardio metrics
async function fetchWorkoutCache() {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', currentUser.id);
  if (!error && data) {
    cachedWorkouts = data;
    computePRMatrix();
  }
}

// Process historical data to find exercise PRs and cardio milestones
function computePRMatrix() {
  strengthPRs = {};
  cardioPR = { distance: 0, duration: 0 };
  cachedWorkouts.forEach(workout => {
    if (workout.category === 'cardio') {
      const sets = workout.metrics?.sets || [];
      sets.forEach(s => {
        if (s.distance > cardioPR.distance) {
          cardioPR.distance = s.distance;
        }
        if (s.duration > cardioPR.duration) {
          cardioPR.duration = s.duration;
        }
      });
    } else if (workout.exercise_name !== 'Daily Nutritional Matrix' && workout.exercise_name !== 'Biometric Snapshot Engine') {
      const sets = workout.metrics?.sets || [];
      sets.forEach(s => {
        const currentBest = strengthPRs[workout.exercise_name];
        if (!currentBest || s.weight > currentBest.weight) {
          strengthPRs[workout.exercise_name] = {
            weight: s.weight,
            reps: s.reps
          };
        }
      });
    }
  });
  renderPRSidebars();
}

// Render the target sidebars
function renderPRSidebars(selectedDay = null) {
  if (!strengthPRContainer || !cardioPRContainer) return;
  strengthPRContainer.innerHTML = '';
  cardioPRContainer.innerHTML = '';

  // Build Cardio milestones output
  if (cardioPR.distance > 0 || cardioPR.duration > 0) {
    cardioPRContainer.innerHTML = `
      <div style="font-size: 0.8rem; background: rgba(255,255,255,0.02); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-subtle);">
        <div>🏃 Max Distance: <strong>${cardioPR.distance}</strong> miles/km</div>
        <div style="margin-top: 0.15rem;">⏱️ Max Duration: <strong>${cardioPR.duration}</strong> mins</div>
      </div>
    `;
  } else {
    cardioPRContainer.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted);">No cardio PR logs.</p>';
  }

  // Build filtered Strength PR output based on active routine (ensures no massive unorganized lists)
  const filterList = selectedDay ? PROGRAMS[selectedDay] : null;
  let matchesCount = 0;
  Object.keys(strengthPRs).forEach(exName => {
    if (filterList && !filterList.includes(exName)) return;
    matchesCount++;
    const prObj = strengthPRs[exName];
    const row = document.createElement('div');
    row.style.cssText = "font-size: 0.8rem; background: rgba(255,255,255,0.02); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-subtle);";
    row.innerHTML = `<strong>${exName}</strong>: ${prObj.weight} lbs/kg x ${prObj.reps} reps`;
    strengthPRContainer.appendChild(row);
  });

  if (matchesCount === 0) {
    strengthPRContainer.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted);">No logs match this filter.</p>';
  }
}

function populateSubDays(routineName) {
  if (!routineName) {
    if (programSelectGroup) {
      programSelectGroup.classList.add('hidden');
    }
    if (workoutLoggingForm) {
      workoutLoggingForm.classList.add('hidden');
    }
    return;
  }
  if (programSelectGroup) {
    programSelectGroup.classList.remove('hidden');
  }
  if (programSelect) {
    programSelect.innerHTML = '<option value="">-- Choose Today\'s Focus Day --</option>';
    const subDays = ROUTINES[routineName];
    subDays.forEach(day => {
      const option = document.createElement('option');
      option.value = day;
      option.textContent = day;
      programSelect.appendChild(option);
    });
  }
}

if (routineSelect) {
  routineSelect.addEventListener('change', async (e) => {
    const selectedRoutine = e.target.value;
    populateSubDays(selectedRoutine);
    if (workoutLoggingForm) {
      workoutLoggingForm.classList.add('hidden');
    }
    if (exerciseContainer) {
      exerciseContainer.innerHTML = '';
    }
    if (selectedRoutine && currentUser) {
      const { data: globalProg } = await supabase
        .from('programs')
        .select('id')
        .eq('name', selectedRoutine)
        .maybeSingle();
      if (globalProg) {
        await supabase
          .from('profiles')
          .update({
            current_program_id: globalProg.id
          })
          .eq('id', currentUser.id);
      }
    }
  });
}

if (programSelect) {
  programSelect.addEventListener('change', (e) => {
    const selectedDay = e.target.value;
    generateExerciseForm(selectedDay);
    fetchAndRenderHistory(selectedDay);
    renderPRSidebars(selectedDay); // Dynamically filter sidebars to show ONLY routine PRs!
  });
}

// Generate dynamic Weight Training Input Fields with inline target PR displays!
function generateExerciseForm(selectedDay) {
  if (!selectedDay) {
    if (workoutLoggingForm) {
      workoutLoggingForm.classList.add('hidden');
    }
    return;
  }
  if (workoutLoggingForm) {
    workoutLoggingForm.classList.remove('hidden');
  }
  if (exerciseContainer) {
    exerciseContainer.innerHTML = '';
    const exerciseList = PROGRAMS[selectedDay] || [];
    exerciseList.forEach((exerciseName, exIndex) => {
      const exerciseWrapper = document.createElement('div');
      exerciseWrapper.className = 'exercise-log-block';
      exerciseWrapper.setAttribute('data-exercise-name', exerciseName);
      
      // Find existing PR for target label
      const prObj = strengthPRs[exerciseName];
      const prText = prObj 
        ? `Target PR: <strong>${prObj.weight}</strong> lbs/kg x <strong>${prObj.reps}</strong> reps`
        : `No previous lifts recorded.`;

      exerciseWrapper.innerHTML = `
        <h4 style="margin-bottom: 0.25rem; color: var(--text-primary); font-size: 1.1rem;">${exIndex + 1}. ${exerciseName}</h4>
        <p style="font-size: 0.8rem; color: var(--accent-neon); margin-bottom: 1rem;">${prText}</p>
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
}

if (exerciseContainer) {
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
}

function setupDietRatingListeners() {
  const container = document.getElementById('dietRatingSelector');
  if (!container) return;
  const labels = container.querySelectorAll('.diet-btn');
  labels.forEach(label => {
    label.addEventListener('click', () => {
      labels.forEach(l => {
        l.classList.remove('selected');
      });
      label.classList.add('selected');
    });
  });
}

if (workoutLoggingForm) {
  workoutLoggingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isTrialExpired) return showStatus("Trial expired.", "error");
    showStatus("", "");
    const selectedDay = programSelect ? programSelect.value : ''; 
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
      await fetchWorkoutCache();
      fetchAndRenderHistory(selectedDay);
    } catch (err) {
      showStatus(`Failed to save: ${err.message}`, "error");
    }
  });
}

if (cardioLoggingForm) {
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
      await fetchWorkoutCache();
      fetchAndRenderHistory(selectedDay);
    } catch (err) {
      console.error("Cardio save error:", err);
      showStatus(`Cardio save failure: ${err.message}`, "error");
    }
  });
}

if (dietLoggingForm) {
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
      document.querySelectorAll('.diet-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
      dietLoggingForm.reset();
      await fetchWorkoutCache();
      fetchAndRenderHistory(selectedDay);
    } catch (err) {
      console.error("Diet save error:", err);
      showStatus(`Diet save failure: ${err.message}`, "error");
    }
  });
}

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

// Render history grouped by calendar dates
async function fetchAndRenderHistory(selectedDayFilter = null) {
  if (historyGrid) {
    historyGrid.innerHTML = '';
    if (!cachedWorkouts || cachedWorkouts.length === 0) {
      if (noHistoryMsg) {
        noHistoryMsg.style.display = 'block';
        historyGrid.appendChild(noHistoryMsg);
      }
      return;
    }
    if (noHistoryMsg) noHistoryMsg.style.display = 'none';

    const groupedByDate = {};
    cachedWorkouts.forEach(log => {
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
        const matchingLifts = cachedWorkouts.filter(log => {
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

    const workoutIdsOnScreen = cachedWorkouts.filter(w => latestDates.includes(w.log_date)).map(w => w.id);
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
      dayCard.style.cssText = "background: #111a2e; border: 1px solid var(--border-subtle); border-radius: 8px; margin-bottom: 0.75rem; overflow: hidden; cursor: pointer; transition: all 0.2s ease;";
      
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
          let topLiftingSet = allSetsForThisExercise.reduce((max, cur) => {
            if (!max) return cur;
            if (cur.weight > max.weight) return cur;
            if (cur.weight === max.weight && cur.reps > max.reps) return cur;
            return max;
          }, null);

          if (topLiftingSet) {
            detailsHTML += `
              <div style="margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.02);">
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

      dayCard.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        const detailsBlock = dayCard.querySelector('.day-card-details');
        const isHidden = detailsBlock.classList.contains('hidden');
        document.querySelectorAll('.day-card-details').forEach(el => {
          el.classList.add('hidden');
        });

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
}

// ==========================================================================
// BIOMETRIC ENGINE MATH & PROGRESSIVE OVERLOAD VISUALS
// ==========================================================================
const biometricForm = document.getElementById('biometricForm');
const biometricResults = document.getElementById('biometricResults');
const biometricHistoryList = document.getElementById('biometricHistoryList');

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
    if (riskContainer) {
      riskContainer.textContent = riskText;
      riskContainer.style.backgroundColor = riskColor;
      riskContainer.style.color = fontColor;
    }

    document.getElementById('resDietTarget').textContent = `${targetCalories} Calories / day`;
    biometricResults.classList.remove('hidden');

    const todayDateString = new Date().toISOString().split('T')[0];
    const payload = [{
      user_id: currentUser.id,
      log_date: todayDateString,
      category: 'weight_training', 
      exercise_name: 'Biometric Snapshot Engine',
      routine_focus: programSelect ? programSelect.value : 'Biometrics Log',
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
// TWO STATIC GRAPHS FOR CLIENTS (Body & Nutrition Journey + Performance Volume)
// ==========================================================================
let bodyChartInstance = null;
let performanceChartInstance = null;

async function renderAnalyticsChart() {
  if (!currentUser) return;
  
  const bodyCtx = document.getElementById('bodyChart');
  const performanceCtx = document.getElementById('performanceChart');
  if (!bodyCtx || !performanceCtx) return;

  // Destroy previous instances
  if (bodyChartInstance) bodyChartInstance.destroy();
  if (performanceChartInstance) performanceChartInstance.destroy();

  const timeframeSelect = document.getElementById('chartTimeframe');
  const timeframeDays = timeframeSelect ? parseInt(timeframeSelect.value, 10) : 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);
  const cutoffDateString = cutoffDate.toISOString().split('T')[0];

  // Fetch biometric snapshots
  const { data: bioRecords } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('exercise_name', 'Biometric Snapshot Engine')
    .gte('log_date', cutoffDateString) 
    .order('log_date', { ascending: true });

  // Fetch workout sessions
  const { data: workoutRecords } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('category', 'weight_training')
    .gte('log_date', cutoffDateString) 
    .order('log_date', { ascending: true });

  // 📈 GRAPH 1: Render Body Journey (Weight, Waist, and BMI over time)
  if (bioRecords && bioRecords.length > 0) {
    const labels = bioRecords.map(r => r.log_date);
    const weightData = bioRecords.map(r => r.metrics?.weight || 0);
    const waistData = bioRecords.map(r => r.metrics?.waist || 0);
    const bmiData = bioRecords.map(r => r.metrics?.bmi || 0);

    bodyChartInstance = new Chart(bodyCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Weight (lbs)', data: weightData, borderColor: getComputedColor('--accent-neon', '#39ff14'), backgroundColor: 'transparent', borderWidth: 2, tension: 0.2 },
          { label: 'Waist (in)', data: waistData, borderColor: '#00d2ff', backgroundColor: 'transparent', borderWidth: 2, tension: 0.2 },
          { label: 'BMI Rating', data: bmiData, borderColor: '#ff9f43', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [5, 5], tension: 0.2 }
        ]
      },
      options: getCommonChartOptions()
    });
  } else {
    drawEmptyChartPlaceholder(bodyCtx, `No biometric logs found in the last ${timeframeDays} days.`);
  }

  // 📈 GRAPH 2: Render Strength Volume Overload Chart
  if (workoutRecords && workoutRecords.length > 0) {
    const volumeByDate = {};
    workoutRecords.forEach(log => {
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

    performanceChartInstance = new Chart(performanceCtx, {
      type: 'line',
      data: {
        labels: Object.keys(volumeByDate),
        datasets: [{
          label: 'Total Volume (lbs)',
          data: Object.values(volumeByDate),
          borderColor: getComputedColor('--accent-neon', '#39ff14'),
          backgroundColor: 'rgba(57, 255, 20, 0.03)',
          borderWidth: 2,
          tension: 0.25,
          fill: true
        }]
      },
      options: getCommonChartOptions()
    });
  } else {
    drawEmptyChartPlaceholder(performanceCtx, `No strength volume records found in the last ${timeframeDays} days.`);
  }
}

function getComputedColor(variableName, fallbackColor) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return value || fallbackColor;
}

function getCommonChartOptions() {
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

// ==========================================================================
// UNIVERSAL DASHBOARD INTERFACE VIEW CONTROLLER (TABS)
// ==========================================================================
const tabButtons = document.querySelectorAll('.tab-nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetTabId = button.getAttribute('data-target');

    // Reset all navigation items to inactive state layout
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
      btn.style.color = "var(--text-muted)";
    });
    
    // Set currently selected target tab to active styling
    button.classList.add('active');
    button.style.color = "#ffffff";

    // Hide all tab panels completely from layout view
    tabContents.forEach(content => {
      content.classList.add('hidden');
      content.style.display = "none";
    });

    // Reveal the targeted panel workspace cleanly
    const activeContent = document.getElementById(targetTabId);
    if (activeContent) {
      activeContent.classList.remove('hidden');
      activeContent.style.display = "block";
    }
  });
});

function showStatus(text, type) {
  if (!statusMsg) return;
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

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login/';
  });
}

initDashboard();
```

---

### File 3: Create `/coaches/index.html`
*(The updated, premium-dark Coach Dashboard template. Features a dropdown selection matrix allowing the coach to choose between Strength, Cardio, or comparative BMI vs. Diet Quality charts).*

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coach Workspace | EliteTrack</title>
  <link rel="stylesheet" href="/styles.css"> <!-- Absolute path -->
  <link rel="stylesheet" href="/coaches/coach.css"> <!-- Absolute path -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <header>
    <nav>
      <div class="main-app-header" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
        <div class="header-branding">
          <h2>👑 EliteTrack Coach Workspace</h2>
          <span class="user-email-display" id="userEmail">coach@email.com</span>
        </div>
        
        <div class="header-actions" style="display: flex; gap: 0.75rem; align-items: center;">
          <button id="coachUpgradeBtn" class="btn-upgrade hidden" style="background: var(--accent-neon); color: #000000; border: none; padding: 0.5rem 1rem; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.85rem;">👑 Upgrade Plan</button>
          <button id="logoutBtn" class="btn-logout" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-subtle); color: #ffffff; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">🚪 Log Out</button>
        </div>
      </div>
    </nav>
  </header>

  <nav class="dashboard-tabs-nav" style="display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 2px solid var(--border-subtle); padding-bottom: 0.5rem; max-width: 1200px; margin-left: auto; margin-right: auto; padding-left: 2rem; padding-right: 2rem;">
    <button type="button" class="tab-nav-btn active" data-target="rosterTab" style="background: none; border: none; color: #ffffff; font-weight: bold; cursor: pointer; padding: 0.5rem 1rem;">👥 Athlete Roster</button>
    <button type="button" class="tab-nav-btn" data-target="brandTab" style="background: none; border: none; color: var(--text-muted); font-weight: bold; cursor: pointer; padding: 0.5rem 1rem;">🎨 Brand Settings</button>
  </nav>

  <main style="padding-top: 1rem;">
    <!-- Active Coach Trial Warning Banner -->
    <div id="coachExpirationBanner" class="expiration-banner hidden">
      <div>
        <h4 style="font-weight: 800; margin-bottom: 0.25rem;">Your Coach Subscription Has Expired</h4>
        <p style="font-size: 0.9rem; color: var(--text-muted);">Please renew your account. All client tracking portfolios are currently locked.</p>
      </div>
      <button id="restartCoachBtn" class="btn-primary" style="background-color: var(--accent-neon); color: #000000; font-size: 0.85rem; padding: 0.6rem 1.2rem;">
        Upgrade Team Account
      </button>
    </div>

    <!-- TAB 1: Athlete Roster Directory -->
    <div id="rosterTab" class="tab-content">
      <div class="dashboard-grid">
        
        <!-- COLUMN 1: Athlete roster directory -->
        <section class="card" style="align-self: flex-start; padding: 1.5rem;">
          <h3 style="margin-bottom: 0.5rem;">Athlete Group</h3>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">Share your invite link to register clients directly: <br>
          <code id="inviteLinkContainer" style="color: var(--accent-neon); font-size: 0.75rem; word-break: break-all; display: block; margin-top: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px;">Loading invite link...</code></p>
          
          <div id="athleteList" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem;">
            <p style="color: var(--text-muted); font-size: 0.85rem;">No athletes on your roster yet.</p>
          </div>
        </section>

        <!-- COLUMN 2: Selected Athlete detailed history and feedback comments -->
        <section class="card" style="align-self: flex-start;">
          <div id="inactiveInspector" style="text-align: center; padding: 4rem 0;">
            <span style="font-size: 3rem;">🔍</span>
            <h4 style="margin-top: 1rem; color: var(--text-primary);">No Athlete Selected</h4>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.5rem;">Select an athlete from the roster list to audit their logs, change status, and send comments.</p>
          </div>

          <div id="activeInspector" class="hidden">
            <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h3 id="inspectAthleteName" style="margin: 0; color: #fff;">Athlete Name</h3>
                <p id="inspectAthleteEmail" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">athlete@email.com</p>
              </div>

              <!-- ACCOUNT SUSPENSION CONTROL SELECTOR -->
              <div style="text-align: right;">
                <label for="athleteStatusSelect" style="display: block; font-size: 0.75rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.25rem;">Athlete Status</label>
                <select id="athleteStatusSelect" style="background: var(--bg-main); color: #fff; border: 1px solid var(--border-subtle); padding: 0.4rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold; cursor: pointer;">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="closed">Closed / Archive</option>
                </select>
              </div>
            </div>

            <!-- Dynamic Graph Suite for Coaches -->
            <div class="card" style="background: #111a2e; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <h4 style="font-size: 0.85rem; color: #fff; text-transform: uppercase;">📈 Coach Analytics Matrix</h4>
                <select id="coachChartSelector" style="background: #0b111e; color: #ffffff; border: 1px solid var(--border-subtle); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                  <option value="volume" selected>Strength Volume Over Time</option>
                  <option value="cardio">Cardio Output Over Time</option>
                  <option value="diet">BMI vs. Diet Quality rating</option>
                </select>
              </div>
              <div style="position: relative; width: 100%; height: 180px; background: rgba(0,0,0,0.15); border-radius: 6px; padding: 0.5rem;">
                <canvas id="coachAnalyticsChart"></canvas>
              </div>
            </div>

            <!-- Athlete biometrics quick lookup -->
            <div id="inspectBiometricsBlock" class="hidden" style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem;">
              <h4 style="font-size: 0.85rem; color: var(--accent-neon); margin-bottom: 0.5rem; text-transform: uppercase;">Latest Weight & Biometrics</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; font-size: 0.8rem;">
                <div><strong>Weight:</strong> <span id="inspectBioWeight">-</span> lbs</div>
                <div><strong>Waist:</strong> <span id="inspectBioWaist">-</span>"</div>
                <div><strong>Calories:</strong> <span id="inspectBioCal">-</span> cal</div>
              </div>
            </div>

            <h4 style="margin-bottom: 1rem; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px; color: var(--text-muted);">Session Audits</h4>
            <div id="athleteHistoryGrid" class="workout-history-grid">
              <!-- Dynamically populated from JS -->
            </div>
          </div>
        </section>

      </div>
    </div>

    <!-- TAB 2: Brand Settings customization -->
    <div id="brandTab" class="tab-content hidden" style="display: none;">
      <div style="max-width: 600px; margin: 0 auto;" class="card">
        <h3 style="margin-bottom: 0.5rem;">White-Label Settings</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">Customized branding options apply directly to all clients on your roster instantly on login.</p>
        
        <form id="brandForm">
          <div class="form-group">
            <label for="brandPrimaryColor">Theme Primary Accent Color</label>
            <div style="display: flex; gap: 1rem; align-items: center;">
              <input type="color" id="brandPrimaryColor" style="width: 50px; height: 40px; background: none; border: 1px solid var(--border-subtle); cursor: pointer;" value="#39ff14">
              <span style="font-size: 0.85rem; color: var(--text-muted);">Pick colors that accent buttons and highlights (e.g. Neon green)</span>
            </div>
          </div>

          <div class="form-group">
            <label for="brandSecondaryColor">Theme Hover Accent Color</label>
            <div style="display: flex; gap: 1rem; align-items: center;">
              <input type="color" id="brandSecondaryColor" style="width: 50px; height: 40px; background: none; border: 1px solid var(--border-subtle); cursor: pointer;" value="#29d609">
              <span style="font-size: 0.85rem; color: var(--text-muted);">Pick slightly darker colors for hover interactions</span>
            </div>
          </div>

          <div class="form-group">
            <label for="brandLogoUrl">Custom Logo Image URL</label>
            <input type="url" id="brandLogoUrl" class="workout-input" placeholder="e.g. https://yourdomain.com/logo.png">
          </div>

          <div style="border-top: 1px solid var(--border-subtle); padding-top: 1.5rem; margin-top: 1.5rem; margin-bottom: 1rem;">
            <h4 style="color: #fff; margin-bottom: 1rem; font-size: 1rem;">Public Trainer Contact Card</h4>
          </div>

          <div class="form-group">
            <label for="brandPhone">Public Contact Phone</label>
            <input type="tel" id="brandPhone" class="workout-input" placeholder="e.g. (555) 555-5555">
          </div>

          <div class="form-group">
            <label for="brandAddress">Public Gym Address / Info</label>
            <input type="text" id="brandAddress" class="workout-input" placeholder="e.g. 123 Elite Athletics Gym, Suite A">
          </div>

          <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">
            Save Brand Configurations
          </button>
        </form>

        <div id="brandStatusMsg" class="hidden" style="margin-top: 1.5rem; padding: 1rem; border-radius: 6px; text-align: center;"></div>
      </div>
    </div>

  </main>

  <script src="/coaches/coach.js" type="module"></script>
</body>
</html>
```

---

### File 4: Create `/coaches/coach.js`
*(The updated Coach controller. Aligned to fetch client datasets securely and render a customizable Coach Analytics Matrix. Allows the coach to dynamically switch the graph between Strength Overload volume, Cardio mileage trends, or dual-axis BMI vs. Diet Quality charts).*

```javascript
// coaches/coach.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

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

// Coach Chart Selector
const coachChartSelector = document.getElementById('coachChartSelector');

let currentCoachId = null;
let activeClientId = null;
let activeClientEmail = null;
let coachChartInstance = null;

// Routing Security Guard: Only allow valid coaches in this directory
async function initCoachDashboard() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    window.location.href = '/login/';
    return;
  }

  currentCoachId = session.user.id;
  if (userEmailDisplay) userEmailDisplay.textContent = session.user.email;

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
    window.location.href = '/dashboard/';
    return;
  }

  // Check coach trial/billing expiration with a safe date fallback
  const trialEndsDate = profile.trial_ends_at 
    ? new Date(profile.trial_ends_at) 
    : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000); // Safe Fallback
  
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

  // Populate brand customization form inputs
  if (profile.theme_primary_color && brandPrimaryColor) brandPrimaryColor.value = profile.theme_primary_color;
  if (profile.theme_secondary_color && brandSecondaryColor) brandSecondaryColor.value = profile.theme_secondary_color;
  if (profile.logo_url && brandLogoUrl) brandLogoUrl.value = profile.logo_url;
  if (profile.contact_phone && brandPhone) brandPhone.value = profile.contact_phone;
  if (profile.contact_address && brandAddress) brandAddress.value = profile.contact_address;

  // Fetch team roster
  fetchRoster();
  setupRealtimeComments();

  if (coachChartSelector) {
    coachChartSelector.addEventListener('change', () => {
      renderCoachChart();
    });
  }
}

// Fetch clients linked to this coach
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

  if (!athleteList) return;
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

initCoachDashboard();
