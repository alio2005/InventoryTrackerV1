import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type EntryStatus = "pending" | "approved" | "rejected" | "edited";

const allowedStatuses: EntryStatus[] = [
  "pending",
  "approved",
  "rejected",
  "edited",
];

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
      admin_note,
      created_at,
      hr_employees (
        first_name,
        last_name,
        employee_code,
        department,
        work_location,
        job_title
      )
    `
    )
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (entriesError) {
    return NextResponse.json({ error: entriesError.message }, { status: 500 });
  }

  return NextResponse.json({ entries: entries ?? [] });
}

export async function PATCH(request: Request) {
  const { supabaseAdmin, error, status, userId } = await requireHRAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  const body = await request.json();

  const entryId = String(body.entryId ?? "").trim();
  const newStatus = String(body.status ?? "").trim() as EntryStatus;
  const adminNote = String(body.adminNote ?? "").trim();

  if (!entryId) {
    return NextResponse.json(
      { error: "Time entry ID is required." },
      { status: 400 }
    );
  }

  if (!allowedStatuses.includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("hr_time_entries")
    .update({
      status: newStatus,
      admin_note: adminNote || null,
      approved_by: newStatus === "approved" ? userId : null,
      approved_at: newStatus === "approved" ? now : null,
      updated_at: now,
    })
    .eq("id", entryId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Time entry marked as ${newStatus}.`,
  });
}