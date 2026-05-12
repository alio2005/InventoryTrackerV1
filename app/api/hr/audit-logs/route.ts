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

async function requireHRAdmin(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return {
      supabaseAdmin: null,
      error: "Missing Supabase server credentials.",
      status: 500,
      userId: null,
    };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return {
      supabaseAdmin,
      error: "Missing authorization token.",
      status: 401,
      userId: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return {
      supabaseAdmin,
      error: "Invalid or expired session.",
      status: 401,
      userId: null,
    };
  }

  const { data: appRoles, error: rolesError } = await supabaseAdmin
    .from("app_user_roles")
    .select("app_key, role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .in("app_key", ["global", "hr"]);

  if (rolesError) {
    return {
      supabaseAdmin,
      error: rolesError.message,
      status: 500,
      userId: user.id,
    };
  }

  const hasHRAccess = Boolean(appRoles && appRoles.length > 0);

  if (!hasHRAccess) {
    return {
      supabaseAdmin,
      error: "HR admin access required.",
      status: 403,
      userId: user.id,
    };
  }

  return {
    supabaseAdmin,
    error: null,
    status: 200,
    userId: user.id,
  };
}

export async function GET(request: Request) {
  const { supabaseAdmin, error, status } = await requireHRAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  const { data: logs, error: logsError } = await supabaseAdmin
    .from("hr_audit_logs")
    .select(
      `
      id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      details,
      created_at
    `
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const users = usersData?.users ?? [];

  const logsWithActors = (logs ?? []).map((log: any) => {
    const actor = users.find((user) => user.id === log.actor_user_id);

    return {
      ...log,
      actor_email: actor?.email ?? "Unknown user",
    };
  });

  return NextResponse.json({
    logs: logsWithActors,
  });
}