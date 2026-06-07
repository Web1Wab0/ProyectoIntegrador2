import type { SupabaseClient, User } from "@supabase/supabase-js";

export type UserRole = "customer" | "merchant" | "admin";

export type ProfileDetails = {
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  role: UserRole | null;
};

type ProfileRow = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
};

type ProfileWriteInput = {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  role?: UserRole | null;
};

export function normalizeRole(value: unknown): UserRole | null {
  return value === "customer" || value === "merchant" || value === "admin"
    ? value
    : null;
}

export function buildFullName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
}

export function splitFullName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return {
      firstName: parts[0] ?? "",
      lastName: "",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function getUserMetadataProfile(user: User): ProfileDetails {
  const metadata = user.user_metadata ?? {};
  const fallbackName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
      ? metadata.name
      : "";
  const splitName = splitFullName(fallbackName);
  const firstName =
    typeof metadata.first_name === "string"
      ? metadata.first_name
      : splitName.firstName;
  const lastName =
    typeof metadata.last_name === "string" ? metadata.last_name : splitName.lastName;
  const fullName = buildFullName(firstName, lastName) || fallbackName;

  return {
    firstName,
    lastName,
    fullName,
    phone: typeof metadata.phone === "string" ? metadata.phone : "",
    role: normalizeRole(metadata.role),
  };
}

export function normalizeProfileRow(row: ProfileRow | null | undefined): ProfileDetails {
  const splitName = splitFullName(row?.full_name);
  const firstName = row?.first_name ?? splitName.firstName;
  const lastName = row?.last_name ?? splitName.lastName;
  const fullName = buildFullName(firstName, lastName) || row?.full_name || "";

  return {
    firstName,
    lastName,
    fullName,
    phone: row?.phone ?? "",
    role: normalizeRole(row?.role),
  };
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false;

  return (
    error.code === "42703" ||
    error.message?.toLowerCase().includes("column") ||
    error.message?.toLowerCase().includes("schema cache")
  );
}

export async function readProfileWithFallback(
  supabase: SupabaseClient,
  userId: string
) {
  const detailed = await supabase
    .from("profiles")
    .select("first_name, last_name, full_name, role, phone")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (!detailed.error) {
    return normalizeProfileRow(detailed.data);
  }

  if (!isMissingColumnError(detailed.error)) {
    throw detailed.error;
  }

  const basic = await supabase
    .from("profiles")
    .select("full_name, role, phone")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (basic.error) {
    throw basic.error;
  }

  return normalizeProfileRow(basic.data);
}

function getDetailedPayload(input: ProfileWriteInput) {
  const fullName = buildFullName(input.firstName, input.lastName);
  const payload: Record<string, string | null> = {
    id: input.userId,
    first_name: input.firstName.trim() || null,
    last_name: input.lastName.trim() || null,
    full_name: fullName || null,
    phone: input.phone.trim() || null,
  };

  if (input.role) {
    payload.role = input.role;
  }

  return payload;
}

function getBasicPayload(input: ProfileWriteInput) {
  const fullName = buildFullName(input.firstName, input.lastName);
  const payload: Record<string, string | null> = {
    id: input.userId,
    full_name: fullName || null,
    phone: input.phone.trim() || null,
  };

  if (input.role) {
    payload.role = input.role;
  }

  return payload;
}

export async function upsertProfileWithFallback(
  supabase: SupabaseClient,
  input: ProfileWriteInput
) {
  const detailed = await supabase
    .from("profiles")
    .upsert(getDetailedPayload(input), { onConflict: "id" });

  if (!detailed.error) return;

  if (!isMissingColumnError(detailed.error)) {
    throw detailed.error;
  }

  const basic = await supabase
    .from("profiles")
    .upsert(getBasicPayload(input), { onConflict: "id" });

  if (basic.error) {
    throw basic.error;
  }
}

export async function updateProfileWithFallback(
  supabase: SupabaseClient,
  input: ProfileWriteInput
) {
  const detailedPayload = getDetailedPayload(input);
  delete detailedPayload.id;

  const detailed = await supabase
    .from("profiles")
    .update(detailedPayload)
    .eq("id", input.userId);

  if (!detailed.error) return;

  if (!isMissingColumnError(detailed.error)) {
    throw detailed.error;
  }

  const basicPayload = getBasicPayload(input);
  delete basicPayload.id;

  const basic = await supabase
    .from("profiles")
    .update(basicPayload)
    .eq("id", input.userId);

  if (basic.error) {
    throw basic.error;
  }
}

export async function ensureProfileForUser(
  supabase: SupabaseClient,
  user: User,
  fallbackRole?: UserRole | null,
  options?: { preferFallbackRole?: boolean }
) {
  const metadataProfile = getUserMetadataProfile(user);
  const normalizedFallbackRole = normalizeRole(fallbackRole);
  let currentProfile: ProfileDetails | null = null;

  try {
    currentProfile = await readProfileWithFallback(supabase, user.id);
  } catch {
    currentProfile = null;
  }

  const nextRole =
    options?.preferFallbackRole && normalizedFallbackRole
      ? normalizedFallbackRole
      : currentProfile?.role ?? metadataProfile.role ?? normalizedFallbackRole ?? null;

  const nextProfile: ProfileDetails = {
    firstName: currentProfile?.firstName || metadataProfile.firstName,
    lastName: currentProfile?.lastName || metadataProfile.lastName,
    fullName: currentProfile?.fullName || metadataProfile.fullName,
    phone: currentProfile?.phone || metadataProfile.phone,
    role: nextRole,
  };

  if (nextProfile.firstName || nextProfile.lastName || nextProfile.phone || nextProfile.role) {
    await upsertProfileWithFallback(supabase, {
      userId: user.id,
      firstName: nextProfile.firstName || splitFullName(nextProfile.fullName).firstName,
      lastName: nextProfile.lastName || splitFullName(nextProfile.fullName).lastName,
      phone: nextProfile.phone,
      role: nextProfile.role,
    });
  }

  return nextProfile;
}
