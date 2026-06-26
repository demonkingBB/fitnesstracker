import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Supabase using environment credentials
const SUPABASE_URL = "https://eiiwcvxjtnzetkyjyudi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaXdjdnhqdG56ZXRreWp5dWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTUzNTYsImV4cCI6MjA5Nzg5MTM1Nn0.RXDV2M02Gkgd4GBK4LEz_GVSjr5wqtR27z_Q_EWyHxQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Target Selectors
const signupForm = document.getElementById('signupForm');
const errorBanner = document.getElementById('errorBanner');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('spinner');

// Form Submission Event Interceptor
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Reset UI State
  errorBanner.classList.add('hidden');
  errorBanner.textContent = '';
  
  const fullName = document.getElementById('regName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  // Simple Validation Checks
  if (password.length < 6) {
    showError("Password must be at least 6 characters long.");
    return;
  }

  // Activate Loading Spinner UX
  setLoading(true);

  try {
    // Fire user creation directly to Supabase Auth engine with custom user metadata
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName,
          phone: phone
        }
      }
    });

    if (error) throw error;

    if (data.user) {
      if (data.session) {
        // If email confirmation is disabled, user is immediately signed in.
        window.location.href = '/dashboard/';
      } else {
        // If email confirmation is enabled, redirect to login page.
        alert("Registration successful! Please check your email inbox to verify your account.");
        window.location.href = '/login/';
      }
    }

  } catch (err) {
    console.error("Signup build logging exception: ", err.message);
    showError(err.message || "An unexpected error occurred during signup.");
    setLoading(false);
  }
});

// UI State Modifiers
function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
}

function setLoading(isLoading) {
  if (isLoading) {
    submitBtn.disabled = true;
    btnText.textContent = "Creating Account...";
    spinner.classList.remove('hidden');
  } else {
    submitBtn.disabled = false;
    btnText.textContent = "Start Free Trial";
    spinner.classList.add('hidden');
  }
}