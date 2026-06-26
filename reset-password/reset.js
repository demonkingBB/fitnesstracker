import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase Configuration
const SUPABASE_URL = "https://eiiwcvxjtnzetkyjyudi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaXdjdnhqdG56ZXRreWp5dWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTUzNTYsImV4cCI6MjA5Nzg5MTM1Nn0.RXDV2M02Gkgd4GBK4LEz_GVSjr5wqtR27z_Q_EWyHxQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Select DOM elements
const resetForm = document.getElementById('resetForm');
const errorBanner = document.getElementById('errorBanner');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('spinner');

// Confirm that a session was established via email verification link
async function checkAuthSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showError("Invalid or expired reset link. Please request a new link.");
    submitBtn.disabled = true;
  }
}

// Handle Form Submission
resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBanner.classList.add('hidden');

  const newPassword = document.getElementById('newPassword').value;

  // Validation Check
  if (newPassword.length < 6) {
    showError("Password must be at least 6 characters.");
    return;
  }

  setLoading(true);

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) throw error;

    showSuccess("Password updated successfully! Redirecting...");
    setTimeout(() => {
      window.location.href = '/login/';
    }, 2000);

  } catch (err) {
    console.error("Password update issue: ", err.message);
    showError(err.message || "Failed to update password.");
    setLoading(false);
  }
});

// UI helper methods
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

function setLoading(isLoading) {
  if (isLoading) {
    submitBtn.disabled = true;
    btnText.textContent = "Updating...";
    spinner.classList.remove('hidden');
  } else {
    submitBtn.disabled = false;
    btnText.textContent = "Update Password";
    spinner.classList.add('hidden');
  }
}

checkAuthSession();