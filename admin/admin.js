
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

// STEP 1: Add your Supabase project details

const SUPABASE_URL =
  "https://mbpdourqbwvnbijbcxkj.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_NGNZ4XLP0hqe9Xd-vKGC1g_ZBltPgdg";

// STEP 2: Initialize Supabase

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// STEP 3: Get login form elements

const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const loginButton = document.getElementById("login-button");

// STEP 4: Handle login

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  loginButton.disabled = true;
  loginButton.textContent = "Signing in...";
  loginMessage.textContent = "";

  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    if (!data.session) {
      throw new Error("No active session was created.");
    }

    loginMessage.textContent = "Login successful!";
    window.location.replace("dashboard.html");

    // Dashboard will be created in the next step.
    // For now, this confirms authentication works.

  } catch (error) {
    loginMessage.textContent =
      error.message || "Unable to sign in. Please try again.";

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Sign In";

    // Clear password from the form
    document.getElementById("password").value = "";
  }
});
