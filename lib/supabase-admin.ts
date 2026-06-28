import "server-only";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY?.trim();

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const supabaseAdminKey =
  supabaseSecretKey || supabaseServiceRoleKey;

if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is not configured."
  );
}

if (!supabaseAdminKey) {
  throw new Error(
    "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is not configured."
  );
}

if (
  supabaseAdminKey.startsWith("sb_publishable_") ||
  supabaseAdminKey ===
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  throw new Error(
    "The Supabase admin client is using the public/anon key."
  );
}

/**
 * Validate legacy JWT keys.
 * New sb_secret_ keys are not JWTs and do not require this check.
 */
if (!supabaseAdminKey.startsWith("sb_secret_")) {
  try {
    const keyParts = supabaseAdminKey.split(".");

    if (keyParts.length === 3) {
      const payload = JSON.parse(
        Buffer.from(
          keyParts[1],
          "base64url"
        ).toString("utf8")
      );

      if (payload.role !== "service_role") {
        throw new Error(
          `Invalid Supabase server key role: ${
            payload.role || "unknown"
          }. Expected service_role.`
        );
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Unable to validate SUPABASE_SERVICE_ROLE_KEY."
    );
  }
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseAdminKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);