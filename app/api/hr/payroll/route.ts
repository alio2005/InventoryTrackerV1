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
    };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return {
      supabaseAdmin,
      error: "Missing authorization token.",
      status: 401,
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
    };
  }

  const hasHRAccess = Boolean(appRoles && appRoles.length > 0);

  if (!hasHRAccess) {
    return {
      supabaseAdmin,
      error: "HR admin access required.",
      status: 403,
    };
  }

  return {
    supabaseAdmin,
    error: null,
    status: 200,
  };
}

export async function GET(request: Request) {
  const { supabaseAdmin, error, status } = await requireHRAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "Start date and end date are required." },
      { status: 400 }
    );
  }

  const { data: entries, error: entriesError } = await supabaseAdmin
    .from("hr_time_entries")
    .select(
      `
      id,
      employee_id,
      work_date,
      clock_in,
      break_start,
      break_end,
      clock_out,
      total_break_minutes,
      total_paid_minutes,
      status,
      hr_employees (
        first_name,
        last_name,
        employee_code,
        department,
        work_location,
        job_title,
        hourly_rate
      )
    `
    )
    .eq("status", "approved")
    .gte("work_date", startDate)
    .lte("work_date", endDate)
    .order("work_date", { ascending: true });

  if (entriesError) {
    return NextResponse.json({ error: entriesError.message }, { status: 500 });
  }

  return NextResponse.json({
    entries: entries ?? [],
  });
}