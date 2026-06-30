// dashboard/dashboard.js
// dashboard/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Ensure this is at the top level of dashboard.js, not inside initDashboard or others
export function generateExerciseForm(selectedDay) {
  const container = document.getElementById('exerciseContainer');
  const form = document.getElementById('workoutLoggingForm');
  
  if (!selectedDay) {
    if (form) form.classList.add('hidden');
    return;
  }
  
  form.classList.remove('hidden');
  container.innerHTML = '';
  
  const exerciseList = PROGRAMS[selectedDay] || [];
  exerciseList.forEach((exerciseName, exIndex) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'exercise-block';
    wrapper.setAttribute('data-exercise-name', exerciseName);
    
    // NO onclick here
    wrapper.innerHTML = `
      <div class="accordion-header">
        <span>${exIndex + 1}. ${exerciseName}</span>
        <span>▼</span>
      </div>
      <div class="accordion-content">
        <div class="sets-list-container" id="sets-${exIndex}">
          <div class="set-row">
            <span>Set 1</span>
            <input type="number" placeholder="Reps" class="workout-input reps-input" style="width: 80px;">
            <input type="number" placeholder="lbs" class="workout-input weight-input" style="width: 80px;">
          </div>
        </div>
        <button type="button" class="btn-secondary add-set-btn" data-index="${exIndex}" style="font-size: 0.75rem; margin-top: 0.5rem;">+ Add Set</button>
      </div>
    `;
    container.appendChild(wrapper);
  });
}

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
    const blocks = document.querySelectorAll('.exercise-block'); // Changed to match the new container
    const payloadRows = [];
    const todayDateString = new Date().toISOString().split('T')[0];

    // --- REPLACE THE CODE BELOW THIS LINE ---
    blocks.forEach(block => {
      // Add these to dashboard.js

// 1. Generate the accordion structure
function generateExerciseForm(selectedDay) {
  if (!selectedDay) {
    if (workoutLoggingForm) workoutLoggingForm.classList.add('hidden');
    return;
  }
  workoutLoggingForm.classList.remove('hidden');
  exerciseContainer.innerHTML = '';
  
  const exerciseList = PROGRAMS[selectedDay] || [];
  exerciseList.forEach((exerciseName, exIndex) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'exercise-block';
    wrapper.setAttribute('data-exercise-name', exerciseName);
    
    wrapper.innerHTML = `
      <div class="accordion-header">
        <span>${exIndex + 1}. ${exerciseName}</span>
        <span>▼</span>
      </div>
      <div class="accordion-content">
        <div class="sets-list-container" id="sets-${exIndex}">
          <div class="set-row">
            <span>Set 1</span>
            <input type="number" placeholder="Reps" class="workout-input reps-input" style="width: 80px;">
            <input type="number" placeholder="lbs" class="workout-input weight-input" style="width: 80px;">
          </div>
        </div>
        <button type="button" class="btn-secondary add-set-btn" data-index="${exIndex}" style="font-size: 0.75rem; margin-top: 0.5rem;">+ Add Set</button>
      </div>
    `;
    exerciseContainer.appendChild(wrapper);
  });
}



// 4. Update the Submit Logic to ignore empty rows
// Inside your existing form submit listener:

   const repsVal = row.querySelector('.reps-input').value;
   const weightVal = row.querySelector('.weight-input').value;
   
   // Only push if BOTH are filled
   if (repsVal !== '' && weightVal !== '') {
       structuredSetsArray.push({
           set: rowIndex + 1,
           reps: parseInt(repsVal),
           weight: parseFloat(weightVal)
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

    
    function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

setText('resBMI', bmi.toFixed(1));
setText('resBMR', `${Math.round(bmr)} kcal`);
setText('resTDEE', `${Math.round(tdee)} kcal`);
setText('resWHR', whr.toFixed(2));

const riskContainer = document.getElementById('resRisk');
if (riskContainer) {
  riskContainer.textContent = riskText;
  riskContainer.style.backgroundColor = riskColor;
  riskContainer.style.color = fontColor;
}

setText('resDietTarget', `${targetCalories} Calories / day`);

if (biometricResults) {
  biometricResults.classList.remove('hidden');
}
    

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

// Universal click handler for the whole app
document.addEventListener('click', (e) => {
  // 1. Handle Accordion Header clicks
  if (e.target.closest('.accordion-header')) {
    const header = e.target.closest('.accordion-header');
    const content = header.nextElementSibling;
    // Close other accordions
    document.querySelectorAll('.accordion-content').forEach(c => {
      if (c !== content) c.classList.remove('active');
    });
    content.classList.toggle('active');
  }

  // 2. Handle Add Set button clicks
  if (e.target.classList.contains('add-set-btn')) {
    const index = e.target.getAttribute('data-index');
    const container = document.getElementById(`sets-${index}`);
    if (container) {
      const count = container.children.length + 1;
      const row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML = `
        <span>Set ${count}</span>
        <input type="number" placeholder="Reps" class="workout-input reps-input" style="width: 80px;">
        <input type="number" placeholder="lbs" class="workout-input weight-input" style="width: 80px;">
      `;
      container.appendChild(row);
    }
  }
});

initDashboard();

