import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Missing Supabase server credentials." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json(
      { error: "Missing authorization token." },
      { status: 401 }
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { error: "Invalid or expired session." },
      { status: 401 }
    );
  }

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("app_user_roles")
    .select("app_key, role")
    .eq("user_id", user.id);

  if (rolesError) {
    return NextResponse.json({ error: rolesError.message }, { status: 500 });
  }

  // Temporary fallback so old profile admins do not get locked out
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isLegacyAdmin = profile?.role === "admin";

  const isGlobalAdmin =
    isLegacyAdmin ||
    roles?.some((item) => item.app_key === "global" && item.role === "admin");

  const canAccessInventory =
    isGlobalAdmin ||
    roles?.some(
      (item) =>
        item.app_key === "inventory" &&
        ["admin", "staff"].includes(item.role)
    );

  const canAccessHR =
    isGlobalAdmin ||
    roles?.some(
      (item) => item.app_key === "hr" && ["admin", "staff"].includes(item.role)
    );

  const isHRAdmin =
  isGlobalAdmin ||
  roles?.some((item) => item.app_key === "hr" && item.role === "admin");

const isHRStaff =
  isHRAdmin ||
  roles?.some((item) => item.app_key === "hr" && item.role === "staff");

const isInventoryAdmin =
  isGlobalAdmin ||
  roles?.some((item) => item.app_key === "inventory" && item.role === "admin");

const isInventoryStaff =
  isInventoryAdmin ||
  roles?.some((item) => item.app_key === "inventory" && item.role === "staff");

return NextResponse.json({
  email: user.email,
  roles: roles ?? [],
  access: {
    globalAdmin: Boolean(isGlobalAdmin),

    inventory: Boolean(canAccessInventory),
    inventoryAdmin: Boolean(isInventoryAdmin),
    inventoryStaff: Boolean(isInventoryStaff),

    hr: Boolean(canAccessHR),
    hrAdmin: Boolean(isHRAdmin),
    hrStaff: Boolean(isHRStaff),

    adminSettings: Boolean(isGlobalAdmin),
  },
});
}