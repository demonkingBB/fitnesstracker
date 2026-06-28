import {
  createClient
} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const SUPABASE_URL =
  "https://eiiwcvxjtnzetky" +
  "jyudi.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX" +
  "VCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJl" +
  "ZiI6ImVpaXdjdnhqdG56ZXRreWp5dWRp" +
  "Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3" +
  "ODIzMTUzNTYsImV4cCI6MjA5Nzg5MTM1" +
  "Nn0.RXDV2M02Gkgd4GBK4LEz_GVSjr5w" +
  "qtR27z_Q_EWyHxQ";
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
const signupForm =
  document.getElementById(
    'signupForm'
  );
const errorBanner =
  document.getElementById(
    'errorBanner'
  );
const submitBtn =
  document.getElementById(
    'submitBtn'
  );
const btnText =
  document.getElementById(
    'btnText'
  );
const spinner =
  document.getElementById(
    'spinner'
  );
const regRole =
  document.getElementById(
    'regRole'
  );
const signupTitle =
  document.getElementById(
    'signupTitle'
  );
const coachBadge =
  document.getElementById(
    'coachBadge'
  );
const trialNotice =
  document.getElementById(
    'trialNotice'
  );
let incomingCoachId = null;
async function checkInviteLink() {
  const urlParams =
    new URLSearchParams(
      window.location.search
    );
  const coachParam =
    urlParams.get('coach');
  if (coachParam) {
    incomingCoachId = coachParam;
    if (regRole) {
      regRole.value = "client";
      regRole.disabled = true;
    }
    try {
      const { data: coach, error } =
        await supabase
          .from('profiles')
          .select(
            'full_name, ' +
            'theme_primary_color, ' +
            'theme_secondary_color, ' +
            'logo_url'
          )
          .eq('id', coachParam)
          .single();
      if (!error && coach) {
        if (coach.theme_primary_color) {
          document.documentElement
            .style.setProperty(
              '--accent-neon',
              coach.theme_primary_color
            );
        }
        if (coach.theme_secondary_color) {
          document.documentElement
            .style.setProperty(
              '--accent-hover',
              coach.theme_secondary_color
            );
        }
        const logoLink =
          document.querySelector(
            '.logo-link'
          );
        if (logoLink) {
          if (coach.logo_url) {
            logoLink.innerHTML =
              `<img src="${coach.logo_url}" ` +
              `alt="${coach.full_name}" ` +
              `style="max-height: 40px; ` +
              `width: auto; ` +
              `object-fit: contain;">`;
          } else {
            logoLink.textContent =
              `${coach.full_name || 'Coach'}` +
              ` Track`;
          }
        }
        if (signupTitle) {
          signupTitle.textContent =
            "Client Portal Sign Up";
        }
        if (trialNotice) {
          trialNotice.textContent =
            "Connect directly with Coach " +
            (coach.full_name || "Trainer");
        }
        if (btnText) {
          btnText.textContent =
            "Sign Up & Join Team";
        }
        if (coachBadge) {
          const nameString =
            coach.full_name || 'Coach';
          coachBadge.classList
            .remove('hidden');
          coachBadge.textContent =
            `Joining ${nameString}'s Team`;
        }
      }
    } catch (err) {
      console.warn(
        "Invite query failed:",
        err.message
      );
    }
  }
}
if (regRole) {
  regRole.addEventListener(
    'change',
    (e) => {
      if (e.target.value === 'coach') {
        btnText.textContent =
          "Register as Coach";
        if (trialNotice) {
          trialNotice.textContent =
            "Create an account to " +
            "manage client workout " +
            "plans, metrics, and " +
            "real-time chat.";
        }
      } else {
        btnText.textContent =
          "Start Free Trial";
        if (trialNotice) {
          trialNotice.textContent =
            "Start your 4-week free " +
            "trial. No credit card " +
            "required.";
        }
      }
    }
  );
}
if (signupForm) {
  signupForm.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      errorBanner.classList.add(
        'hidden'
      );
      errorBanner.textContent = '';
      const selectedRole = regRole
        ? regRole.value
        : 'client';
      const fullName =
        document.getElementById(
          'regName'
        ).value.trim();
      const phone =
        document.getElementById(
          'regPhone'
        ).value.trim();
      const email =
        document.getElementById(
          'regEmail'
        ).value.trim();
      const password =
        document.getElementById(
          'regPassword'
        ).value;
      if (password.length < 6) {
        showError(
          "Password must be at " +
          "least 6 characters long."
        );
        return;
      }
      setLoading(true);
      const signupOptions = {
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            role: selectedRole
          }
        }
      };
      if (selectedRole === 'client' &&
          incomingCoachId) {
        signupOptions.options
          .data.coach_id =
          incomingCoachId;
      }
      try {
        const { data, error } =
          await supabase.auth
            .signUp(signupOptions);
        if (error) throw error;
        if (data.user) {
          if (data.session) {
            routeUserByRole(
              data.user.id
            );
          } else {
            alert(
              "Registration " +
              "successful! Please " +
              "check your email " +
              "inbox to verify your " +
              "account."
            );
            window.location.href =
              '/login/';
          }
        }
      } catch (err) {
        console.error(
          "Signup exception: ",
          err.message
        );
        showError(
          err.message ||
          "An unexpected error " +
          "occurred during signup."
        );
        setLoading(false);
      }
    }
  );
}
async function routeUserByRole(
  userId
) {
  try {
    const { data: profile } =
      await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    if (profile &&
        profile.role === 'coach') {
      window.location.href =
        '/coaches/';
    } else {
      window.location.href =
        '/dashboard/';
    }
  } catch (err) {
    window.location.href =
      '/dashboard/';
  }
}
function showError(message) {
  errorBanner.style
    .backgroundColor =
    "rgba(239, 68, 68, 0.1)";
  errorBanner.style
    .borderColor =
    "rgba(239, 68, 68, 0.2)";
  errorBanner.style.color =
    "#ef4444";
  errorBanner.textContent = message;
  errorBanner.classList.remove(
    'hidden'
  );
}
function showSuccessNotification(
  message
) {
  errorBanner.style
    .backgroundColor =
    "rgba(57, 255, 20, 0.1)";
  errorBanner.style
    .borderColor =
    "rgba(57, 255, 20, 0.2)";
  errorBanner.style.color =
    "var(--accent-neon)";
  errorBanner.textContent = message;
  errorBanner.classList.remove(
    'hidden'
  );
}
function setLoading(isLoading) {
  const selectedRole = regRole
    ? regRole.value
    : 'client';
  const defaultText =
    selectedRole === 'coach'
      ? "Register as Coach"
      : (incomingCoachId ? "Sign Up & Join Team" : "Start Free Trial");
  if (isLoading) {
    submitBtn.disabled = true;
    btnText.textContent =
      "Creating Account...";
    spinner.classList.remove(
      'hidden'
    );
  } else {
    submitBtn.disabled = false;
    btnText.textContent =
      defaultText;
    spinner.classList.add(
      'hidden'
    );
  }
}
checkInviteLink();