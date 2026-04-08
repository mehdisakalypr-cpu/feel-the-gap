import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { supabaseAdmin } from "@/lib/supabase";

// ── Config ──────────────────────────────────────────────────────────────────────

const RP_NAME = "Feel The Gap";
const RP_ID = process.env.WEBAUTHN_RP_ID || "feel-the-gap.duckdns.org";
const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL || `https://${RP_ID}`;
const APP_ID = "feel-the-gap";

// ── Types ────────────────────────────────────────────────────────────────────────

interface StoredCredential {
  id: string;
  user_id: string;
  app: string;
  public_key: string;
  counter: number;
  device_name: string | null;
  transports: string[] | null;
}

// ── DB helpers ───────────────────────────────────────────────────────────────────

async function getCredentials(userId: string): Promise<StoredCredential[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("webauthn_credentials")
    .select("*")
    .eq("user_id", userId)
    .eq("app", APP_ID);
  return (data ?? []) as StoredCredential[];
}

async function saveCredential(cred: Omit<StoredCredential, "app">) {
  const sb = supabaseAdmin();
  const { error } = await sb.from("webauthn_credentials").insert({
    ...cred,
    app: APP_ID,
  });
  if (error) throw new Error(`Save credential failed: ${error.message}`);
}

async function updateCounter(credId: string, newCounter: number) {
  const sb = supabaseAdmin();
  await sb
    .from("webauthn_credentials")
    .update({ counter: newCounter, last_used_at: new Date().toISOString() })
    .eq("id", credId)
    .eq("app", APP_ID);
}

// ── Challenge store (in-memory, short-lived) ─────────────────────────────────────

const challenges = new Map<string, { challenge: string; expires: number }>();

function storeChallenge(userId: string, challenge: string) {
  challenges.set(userId, { challenge, expires: Date.now() + 5 * 60 * 1000 });
}

function getAndDeleteChallenge(userId: string): string | null {
  const entry = challenges.get(userId);
  challenges.delete(userId);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.challenge;
}

// ── Registration ─────────────────────────────────────────────────────────────────

export async function startRegistration(userId: string, userEmail: string) {
  const existing = await getCredentials(userId);
  const excludeCredentials = existing.map((c) => ({
    id: c.id,
    transports: (c.transports ?? []) as AuthenticatorTransportFuture[],
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: userEmail,
    attestationType: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials,
  });

  storeChallenge(userId, options.challenge);
  return options;
}

export async function finishRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  deviceName?: string
) {
  const expectedChallenge = getAndDeleteChallenge(userId);
  if (!expectedChallenge) throw new Error("Challenge expired or missing");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  const { credential } = verification.registrationInfo;

  await saveCredential({
    id: credential.id,
    user_id: userId,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    device_name: deviceName ?? null,
    transports: credential.transports ?? null,
  });

  return { verified: true, credentialId: credential.id };
}

// ── Authentication ───────────────────────────────────────────────────────────────

export async function startAuthenticationForEmail(email: string) {
  // Look up Supabase user by email
  const sb = supabaseAdmin();
  const { data } = await sb.auth.admin.listUsers();
  const user = data?.users?.find((u) => u.email === email);
  if (!user) return null;

  const credentials = await getCredentials(user.id);
  if (credentials.length === 0) return null;

  const allowCredentials = credentials.map((c) => ({
    id: c.id,
    transports: (c.transports ?? []) as AuthenticatorTransportFuture[],
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: "required",
  });

  storeChallenge(user.id, options.challenge);
  return { options, userId: user.id };
}

export async function finishAuthentication(
  userId: string,
  response: AuthenticationResponseJSON
) {
  const expectedChallenge = getAndDeleteChallenge(userId);
  if (!expectedChallenge) throw new Error("Challenge expired or missing");

  const credentials = await getCredentials(userId);
  const credential = credentials.find((c) => c.id === response.id);
  if (!credential) throw new Error("Credential not found");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: credential.id,
      publicKey: Buffer.from(credential.public_key, "base64url"),
      counter: credential.counter,
      transports: (credential.transports ?? []) as AuthenticatorTransportFuture[],
    },
  });

  if (!verification.verified) throw new Error("Authentication verification failed");

  await updateCounter(credential.id, verification.authenticationInfo.newCounter);
  return { verified: true, userId };
}

export { getCredentials };
