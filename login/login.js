import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase URL & Key Configuration
const SUPABASE_URL = "https://eiiwcvxjtnzetkyjyudi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaXdjdnhqdG56ZXRreWp5dWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTUzNTYsImV4cCI6MjA5Nzg5MTM1Nn0.RXDV2M02Gkgd4GBK4LEz_GVSjr5wqtR27z_Q_EWyHxQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Target Elements
const loginForm = document.getElementById('loginForm');
const errorBanner = document.getElementById('errorBanner');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('spinner');

// Route Guard: Redirect already authenticated users away from the login page
async function checkExistingSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = '/dashboard/';
  }
}

// Intercept Login Submissions
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Reset UI alert banners
  errorBanner.classList.add('hidden');
  errorBanner.textContent = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  setLoading(true);

  try {
    // 1. Authenticate user session with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
  

    if (error) throw error;

    if (data.session && data.user) {
      // 2. Query user profile to verify membership status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.warn("Could not retrieve membership profile details:", profileError.message);
      } else if (profile) {
        const trialEnds = new Date(profile.trial_ends_at);
        const now = new Date();
        const isPaid = profile.subscription_status === 'active';
        
        // Log status to browser debugger to verify mapping works
        if (isPaid) {
          console.log(`Status Check: Active Paid Program Member`);
        } else if (trialEnds > now) {
          console.log(`Status Check: Active Trial. Ends on: ${profile.trial_ends_at}`);
        } else {
          console.log(`Status Check: Trial Expired. Access Restricted.`);
        }
      }

      // 3. Route user to their secure dashboard workspace
      window.location.href = '/dashboard/';
    }

  } 
  
  catch (err) {
    console.error("Login attempt logging exception: ", err.message);
    showError(err.message || "Invalid credentials or authentication error occurred.");
    setLoading(false);
  }
});

// UI Modifier utilities
function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
}

function setLoading(isLoading) {
  if (isLoading) {
    submitBtn.disabled = true;
    btnText.textContent = "Verifying...";
    spinner.classList.remove('hidden');
  } else {
    submitBtn.disabled = false;
    btnText.textContent = "Log In";
    spinner.classList.add('hidden');
  }
}

// Initial Session verification
checkExistingSession();