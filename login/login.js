import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase Configuration
const SUPABASE_URL = "https://eiiwcvxjtnzetkyjyudi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaXdjdnhqdG56ZXRreWp5dWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTUzNTYsImV4cCI6MjA5Nzg5MTM1Nn0.RXDV2M02Gkgd4GBK4LEz_GVSjr5wqtR27z_Q_EWyHxQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Target Elements
const loginForm = document.getElementById('loginForm');
const errorBanner = document.getElementById('errorBanner');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('spinner');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

// Route Guard: Redirect already authenticated users away from the login page
async function checkExistingSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    routeUserByRole(session.user.id);
  }
}

// Redirect Traffic Cop based on Database User Role
async function routeUserByRole(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) throw error;

    if (profile.role === 'coach') {
      window.location.href = '/coaches/';
    } else {
      window.location.href = '/'; // Root Client Dashboard
    }
  } catch (err) {
    console.error("Routing error:", err.message);
    window.location.href = '/'; // Default fallback
  }
}

// Intercept Login Submissions
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  errorBanner.classList.add('hidden');
  errorBanner.textContent = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  setLoading(true, "Verifying...");

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) throw error;

    if (data.session && data.user) {
      routeUserByRole(data.user.id);
    }

  } catch (err) {
    console.error("Login attempt logging exception: ", err.message);
    showError(err.message || "Invalid credentials or authentication error occurred.");
    setLoading(false);
  }
});

// Intercept Forgot Password Reset Email Request
forgotPasswordBtn.addEventListener('click', async (e) => {
  e.preventDefault();

  errorBanner.classList.add('hidden');
  errorBanner.textContent = '';

  const email = document.getElementById('email').value.trim();

  if (!email) {
    showError("Please enter your email address first, then click 'Forgot?' to receive a reset link.");
    return;
  }

  setLoading(true, "Sending...");

  try {
    const redirectUrl = `${window.location.origin}/reset-password/`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) throw error;

    showSuccess("Password reset email sent! Check your inbox.");
  } catch (err) {
    console.error("Forgot password dispatch issue:", err.message);
    showError(err.message || "An error occurred while sending the reset link.");
  } finally {
    setLoading(false);
  }
});

// UI Modifier utilities
function showError(message) {
  errorBanner.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
  errorBanner.style.borderColor = "rgba(239, 68, 68, 0.2)";
  errorBanner.style.color = "#ef4444";
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
}

function showSuccess(message) {
  errorBanner.style.backgroundColor = "rgba(57, 255, 20, 0.1)";
  errorBanner.style.borderColor = "rgba(57, 255, 20, 0.2)";
  errorBanner.style.color = "var(--accent-neon)";
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
}

function setLoading(isLoading, text = "Log In") {
  if (isLoading) {
    submitBtn.disabled = true;
    btnText.textContent = text;
    spinner.classList.remove('hidden');
  } else {
    submitBtn.disabled = false;
    btnText.textContent = "Log In";
    spinner.classList.add('hidden');
  }
}

// Initial Session verification
checkExistingSession();