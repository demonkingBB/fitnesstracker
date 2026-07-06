// dashboard/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ROUTINES, PROGRAMS } from './programdata.js';

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

const strengthPRContainer = document.getElementById('strengthPRContainer');
const cardioPRContainer = document.getElementById('cardioPRContainer');

let currentUser = null;
let isTrialExpired = false;
let activeCoachProfile = null;
let cachedWorkouts = [];
let strengthPRs = {};
let cardioPR = { distance: 0, duration: 0 };
let activeHistoryFilter = "";

await loadMessageCenterWidget();


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
    // MULTI-TENANT ACCESS ENGINE
    if (profile.coach_id) {
      const { data: coach, error: coachError } = await supabase
        .from('profiles')
        .select('full_name, contact_phone, contact_address, theme_primary_color, theme_secondary_color, logo_url, subscription_status, trial_ends_at, background_color, theme_mode')
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

  // Safe early load of the Message Center before other rendering sequences
  try {
    await loadMessageCenterWidget();
  } catch (e) {
    console.warn("Message Center load failed:", e);
  }

  setupDietRatingListeners();
  setupContactCardListeners();
  await fetchWorkoutCache();
  fetchAndRenderHistory();
  fetchAndRenderBiometricHistory();
  renderAnalyticsChart();
  setupRealtimeComments();
}

async function loadMessageCenterWidget() {
  if (!currentUser) return;
  const feed = document.getElementById('mainCommentFeed');
  if (!feed) return;

  feed.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Loading conversation...</p>';

  try {
    // Fetch all comments belonging to the logged-in client
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('user_id', currentUser.id)
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

    // Automatically scroll to the latest message
    feed.scrollTop = feed.scrollHeight;

  } catch (err) {
    console.error("Message Center failed:", err);
    feed.innerHTML = '<p style="color: #ef4444; font-size: 0.85rem;">Error loading conversation.</p>';
  }
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
  if (!coach) return;

  if (coach.theme_primary_color) {
    document.documentElement.style.setProperty('--brand-primary', coach.theme_primary_color);
  }
  if (coach.theme_secondary_color) {
    document.documentElement.style.setProperty('--accent-hover', coach.theme_secondary_color);
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
      logoEl.innerHTML = `<h2>🚀 ${coach.full_name || 'Coach'} Track</h2>`;
    }
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

    // Update the sticky tracker and refresh history instantly
    activeHistoryFilter = selectedRoutine;
    fetchAndRenderHistory(activeHistoryFilter);

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

    // Update sticky tracker: Fall back to overall routine if they deselect the focus day
    activeHistoryFilter = selectedDay || routineSelect.value;
    fetchAndRenderHistory(activeHistoryFilter);
    renderPRSidebars(selectedDay);
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
      exerciseWrapper.className = 'exercise-block';
      exerciseWrapper.setAttribute('data-exercise-name', exerciseName);

      // Retrieve existing personal records for visual guidance
      const prObj = strengthPRs[exerciseName];
      const prText = prObj
        ? `Target PR: <strong>${prObj.weight}</strong> lbs/kg x <strong>${prObj.reps}</strong> reps`
        : `No previous lifts recorded.`;

      exerciseWrapper.innerHTML = `
        <div class="accordion-header">
          <span>${exIndex + 1}. ${exerciseName}</span>
          <span>▼</span>
        </div>
        <div class="accordion-content">
          <p style="font-size: 0.8rem; color: var(--brand-primary); margin-bottom: 1rem;">${prText}</p>
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
        </div>
      `;
      exerciseContainer.appendChild(exerciseWrapper);
    });
  }
}

if (exerciseContainer) {
  exerciseContainer.addEventListener('click', (e) => {
    // 1. Handle Accordion Header Click
    const header = e.target.closest('.accordion-header');
    if (header) {
      const content = header.nextElementSibling;
      if (content) {
        // Close all other open exercise accordions to keep screen clean
        document.querySelectorAll('.accordion-content').forEach(c => {
          if (c !== content) c.classList.remove('active');
        });
        // Toggle the active state on the clicked block
        content.classList.toggle('active');
      }
      return;
    }

    // 2. Handle "+ Add Extra Set" Button Click
    if (e.target.classList.contains('add-set-btn')) {
      const exIndex = e.target.getAttribute('data-index');
      const container = document.getElementById(`setsContainer-${exIndex}`);
      if (container) {
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
    const blocks = document.querySelectorAll('.exercise-block'); // Updated class name
    const payloadRows = [];
    const todayDateString = new Date().toISOString().split('T')[0];

    blocks.forEach(block => {
      const exName = block.getAttribute('data-exercise-name');
      const setRows = block.querySelectorAll('.set-row');
      const structuredSetsArray = [];

      setRows.forEach((row, rowIndex) => {
        const repsVal = parseInt(row.querySelector('.reps-input').value, 10);
        const weightVal = parseFloat(row.querySelector('.weight-input').value);

        // Only save rows where the user actually entered valid numbers
        if (!isNaN(repsVal) && !isNaN(weightVal)) {
          structuredSetsArray.push({
            set: rowIndex + 1,
            reps: repsVal,
            weight: weightVal
          });
        }
      });

      // Only push the exercise log if at least one set contains valid data
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
        routine_focus: activeHistoryFilter || 'Cardio Session',
        metrics: {
          sets: [{ set: 1, duration: durationVal, distance: distanceVal }]
        }
      }];

      const { error } = await supabase.from('workout_logs').insert(payload);
      if (error) throw error;
      showStatus("Cardio milestone recorded!", "success");
      cardioLoggingForm.reset();
      await fetchWorkoutCache();

      // REFRESH: Use the active sticky filter so the history stays perfectly visible!
      fetchAndRenderHistory(activeHistoryFilter);
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
      const activeDropdown = document.getElementById('programSelect');

      // Safety check: Only filter by routine day if one is actually active in your exercise form
      const selectedDay = (activeDropdown && activeDropdown.value && PROGRAMS[activeDropdown.value]) ? activeDropdown.value : "";

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
        routine_focus: selectedDay || 'Nutrition Logging',
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

      // Unfiltered reload if no routine was selected, keeping history full
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
      const mainCommentFeed = document.getElementById('mainCommentFeed');
      if (mainCommentFeed) {
        // Instantly reload the conversation widget
        loadMessageCenterWidget();
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

    // 1. Grouping Phase (Aggregate all logs by date)
    const groupedByDate = {};
    cachedWorkouts.forEach(log => {
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

    let sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

    // 2. Multi-Level Filtering (Dropdown filter matches selected split/routine)
    let allowedExercises = [];
    if (selectedDayFilter && selectedDayFilter !== "") {
      if (PROGRAMS[selectedDayFilter]) {
        allowedExercises = PROGRAMS[selectedDayFilter];
      } else if (ROUTINES[selectedDayFilter]) {
        const subDays = ROUTINES[selectedDayFilter];
        subDays.forEach(day => {
          if (PROGRAMS[day]) {
            allowedExercises = allowedExercises.concat(PROGRAMS[day]);
          }
        });
      }

      // Filter dates list: strictly retain dates containing matching lifts for this routine focus
      sortedDates = sortedDates.filter(dateKey => {
        const dayGroup = groupedByDate[dateKey];
        const matchingLifts = dayGroup.lifts.filter(lift => allowedExercises.includes(lift.exercise_name));

        // Mutate day group lifts to ONLY show those belonging to the active routine focus
        dayGroup.lifts = matchingLifts;

        // STRICT FIX: Only keep this date in the dropdown if we actually logged a matching lift
        return matchingLifts.length > 0;
      });
    }

    if (sortedDates.length === 0) {
      historyGrid.innerHTML = `<p style="color: var(--text-muted); padding: 1rem;">No matching logs found for ${selectedDayFilter || 'this filter'}.</p>`;
      return;
    }

    // 3. Render Dropdown Header and Active Display Card Shell
    historyGrid.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <label style="display: block; font-size: 0.75rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.4rem; letter-spacing: 0.5px;">Select History Date</label>
        <select id="historyDateSelect" class="program-select-dropdown" style="width: 100%; font-weight: 600;"></select>
      </div>
      <div id="activeHistoryCard" class="history-day-card" style="background: #111a2e; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 1.25rem; max-height: 250px; overflow-y: auto;">
        <p style="color: var(--text-muted); font-size: 0.85rem;">Loading day logs...</p>
      </div>
    `;

    const historyDateSelect = document.getElementById('historyDateSelect');
    const activeHistoryCard = document.getElementById('activeHistoryCard');

    // Populate Selector Dropdown Options
    sortedDates.forEach(dateStr => {
      const opt = document.createElement('option');
      opt.value = dateStr;
      opt.textContent = dateStr;
      historyDateSelect.appendChild(opt);
    });

    // 4. Sub-Renderer: Dynamically updates the active display card synchronously (Instant)
    function renderSelectedDateDetails(dateStr) {
      if (!activeHistoryCard) return;

      const dayGroup = groupedByDate[dateStr];
      const dietVal = dayGroup.diet?.metrics?.diet_rating || null;
      const liftCount = dayGroup.lifts.length;
      const hasCardio = dayGroup.cardio !== null;
      const focusName = dayGroup.routine_focus || (liftCount > 0 ? "Strength Training" : (hasCardio ? "Cardio Session" : "Nutrition Log"));

      // Build Details HTML Card Content
      let cardHTML = `
        <div style="font-size: 0.8rem; font-weight: bold; color: var(--brand-primary); text-transform: uppercase; margin-bottom: 1rem; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">📋 ${focusName}</div>
      `;

      // Display Weight Training Lifts
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
          const setsList = exercisesOnThisDay[exerciseName].map(s => `Set ${s.set}: ${s.reps} reps @ ${s.weight} lbs/kg`).join(' | ');
          cardHTML += `
            <div style="margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.02);">
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${exerciseName}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">${setsList}</div>
            </div>`;
        });
      }

      // Display Cardio Session
      if (dayGroup.cardio) {
        const cardioSets = Array.isArray(dayGroup.cardio.metrics.sets) ? dayGroup.cardio.metrics.sets : [];
        const topCardio = cardioSets[0] || { duration: 0, distance: 0 };
        cardHTML += `
          <div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">🏃 Cardio Session</div>
            <div style="font-size: 0.8rem; color: #38bdf8; margin-top: 0.15rem;">${topCardio.distance} miles/km in ${topCardio.duration} mins</div>
          </div>`;
      }

      // Display Diet Metric
      if (dietVal) {
        cardHTML += `
          <div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">🍏 Diet Quality</div>
            <div style="font-size: 0.8rem; color: #39ff14; margin-top: 0.15rem;">Rating: ${dietVal}/5</div>
          </div>`;
      }

      // Paint content to UI instantly
      activeHistoryCard.innerHTML = cardHTML;
    }

    // 5. Connect Dropdown Selection Change Listener
    historyDateSelect.addEventListener('change', (e) => {
      renderSelectedDateDetails(e.target.value);
    });

    // Default: Display latest available date immediately on load
    if (sortedDates.length > 0) {
      renderSelectedDateDetails(sortedDates[0]);
    }
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

// Dedicated Client Message Sender logic
document.addEventListener('DOMContentLoaded', () => {
  const sendCoachMessageBtn = document.getElementById('sendCoachMessageBtn');
  const coachMessageInput = document.getElementById('coachMessageInput');

  if (sendCoachMessageBtn) {
    sendCoachMessageBtn.addEventListener('click', async () => {
      if (!currentUser) return;
      const message = coachMessageInput.value.trim();
      if (!message) return;

      try {
        // 1. Find the client's latest logged session to anchor the comment to
        const { data: latestWorkout, error: fetchErr } = await supabase
          .from('workout_logs')
          .select('id')
          .eq('user_id', currentUser.id)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (!latestWorkout) {
          alert("You have not logged any workouts yet. A message cannot be sent until you record at least one session on your dashboard.");
          return;
        }

        // 2. Insert the comment under the active chat thread
        const { error: insertErr } = await supabase
          .from('comments')
          .insert([{
            user_id: currentUser.id,
            workout_id: latestWorkout.id,
            sender_id: currentUser.id,
            message: message
          }]);

        if (insertErr) throw insertErr;

        // 3. Instant Widget Reload: Clear input and repaint the chat feed
        coachMessageInput.value = '';
        await loadMessageCenterWidget();

      } catch (err) {
        console.error("Failed to send message:", err);
        alert("Failed to send message: " + err.message);
      }
    });
  }
});



initDashboard();

