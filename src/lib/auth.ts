// Sign-in methods, the session and the signed-in user's own profile. Part of
// the data access layer: import it through `api.ts` (ARCHITECTURE.md,
// "Frontend conventions").
import type { Session } from "@supabase/supabase-js";
import { fail } from "./errors";
import { supabase } from "./supabase";
import type { Passkey, Profile } from "./types";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(
  callback: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    callback(session),
  );
  return () => data.subscription.unsubscribe();
}

/** Emails a login link and code. `captchaToken` is needed once CAPTCHA is on in Supabase. */
export async function signInWithEmail(
  email: string,
  redirectTo: string,
  captchaToken?: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, captchaToken },
  });
  if (error) {
    fail(error);
  }
}

/** Logs in with the 6-digit code from the login email (needed in the installed iOS app). */
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) {
    fail(error);
  }
}

export async function signInWithGoogle(redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) {
    fail(error);
  }
}

/** True when this browser can use passkeys at all. */
export function passkeysSupported(): boolean {
  return typeof window.PublicKeyCredential !== "undefined";
}

/** Closing the browser's passkey prompt is not an error worth showing. */
function dismissedPasskeyPrompt(error: { code?: string; cause?: unknown }) {
  return (
    error.code === "ERROR_CEREMONY_ABORTED" ||
    (error.cause instanceof Error && error.cause.name === "NotAllowedError")
  );
}

/**
 * Logs in with a passkey (the browser shows its own prompt). Returns false if
 * the person dismissed the prompt. `captchaToken` is passed along in case
 * CAPTCHA is on in Supabase.
 */
export async function signInWithPasskey(
  captchaToken?: string,
): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPasskey({
    options: { captchaToken },
  });
  if (error) {
    if (dismissedPasskeyPrompt(error)) {
      return false;
    }
    fail(error);
  }
  return true;
}

/** Registers a passkey for the signed-in user. Returns false if the prompt was dismissed. */
export async function registerPasskey(): Promise<boolean> {
  const { error } = await supabase.auth.registerPasskey();
  if (error) {
    if (dismissedPasskeyPrompt(error)) {
      return false;
    }
    fail(error);
  }
  return true;
}

export async function listPasskeys(): Promise<Passkey[]> {
  const { data, error } = await supabase.auth.passkey.list();
  if (error) {
    fail(error);
  }
  return data ?? [];
}

export async function deletePasskey(passkeyId: string): Promise<void> {
  const { error } = await supabase.auth.passkey.delete({ passkeyId });
  if (error) {
    fail(error);
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    fail(error);
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    fail(error);
  }
  return data;
}

export async function updateMyName(
  userId: string,
  displayName: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId);
  if (error) {
    fail(error);
  }
}
