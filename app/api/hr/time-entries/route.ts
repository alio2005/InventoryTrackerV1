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

function minutesBetween(start: string, end: string) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return 0;
  }

  return Math.max(Math.round((endTime - startTime) / 60000), 0);
}

function getMonthRange(monthValue: string | null) {
  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  const month = /^\d{4}-\d{2}$/.test(monthValue || "")
    ? String(monthValue)
    : fallbackMonth;

  const [year, monthNumber] = month.split("-").map(Number);

  const startDate = `${year}-${String(monthNumber).padStart(2, "0")}-01`;

  const end = new Date(year, monthNumber, 0);
  const endDate = `${year}-${String(monthNumber).padStart(2, "0")}-${String(
    end.getDate()
  ).padStart(2, "0")}`;

  return {
    month,
    startDate,
    endDate,
  };
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

async function createAuditLog({
  supabaseAdmin,
  actorUserId,
  action,
  entityType,
  entityId,
  details,
}: {
  supabaseAdmin: any;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
}) {
  const payload = {
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  };

  const { error } = await supabaseAdmin.from("hr_audit_logs").insert(payload);

  if (error) {
    console.error("Audit log insert error:", error.message);
  }
}

export async function GET(request: Request) {
  const { supabaseAdmin, error, status } = await requireHRAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  const { searchParams } = new URL(request.url);
  const { month, startDate, endDate } = getMonthRange(
    searchParams.get("month")
  );

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
      updated_at,
      approved_at,
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
    .gte("work_date", startDate)
    .lte("work_date", endDate)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (entriesError) {
    return NextResponse.json({ error: entriesError.message }, { status: 500 });
  }

  const entryIds = (entries ?? []).map((entry: any) => entry.id);
  const employeeIds = Array.from(
    new Set((entries ?? []).map((entry: any) => entry.employee_id))
  );

  let breakSessions: any[] = [];
  let schedules: any[] = [];

  if (entryIds.length > 0) {
    const { data: breaks, error: breaksError } = await supabaseAdmin
      .from("hr_break_sessions")
      .select(
        `
        id,
        time_entry_id,
        break_start,
        break_end,
        break_minutes
      `
      )
      .in("time_entry_id", entryIds)
      .order("break_start", { ascending: true });

    if (breaksError) {
      return NextResponse.json({ error: breaksError.message }, { status: 500 });
    }

    breakSessions = breaks ?? [];
  }

  if (employeeIds.length > 0) {
    const { data: scheduleRows, error: schedulesError } = await supabaseAdmin
      .from("hr_employee_schedules")
      .select(
        `
        id,
        employee_id,
        weekday,
        work_mode,
        scheduled_start,
        scheduled_end,
        grace_minutes
      `
      )
      .in("employee_id", employeeIds)
      .order("weekday", { ascending: true });

    if (schedulesError) {
      return NextResponse.json(
        { error: schedulesError.message },
        { status: 500 }
      );
    }

    schedules = scheduleRows ?? [];
  }

  const entriesWithExtras = (entries ?? []).map((entry: any) => {
    const workDate = new Date(`${entry.work_date}T12:00:00`);
    const weekday = workDate.getDay();

    const matchingSchedule =
      schedules.find(
        (schedule) =>
          schedule.employee_id === entry.employee_id &&
          schedule.weekday === weekday
      ) ?? null;

    return {
      ...entry,
      hr_break_sessions: breakSessions.filter(
        (breakSession) => breakSession.time_entry_id === entry.id
      ),
      schedule: matchingSchedule,
    };
  });

  return NextResponse.json({
    month,
    startDate,
    endDate,
    entries: entriesWithExtras,
  });
}

export async function PATCH(request: Request) {
  const { supabaseAdmin, error, status, userId } = await requireHRAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  const body = await request.json();

  const mode = String(body.mode ?? "status").trim();
  const entryId = String(body.entryId ?? "").trim();

  if (!entryId) {
    return NextResponse.json(
      { error: "Time entry ID is required." },
      { status: 400 }
    );
  }

  const { data: existingEntry, error: existingError } = await supabaseAdmin
    .from("hr_time_entries")
    .select("*")
    .eq("id", entryId)
    .single();

  if (existingError || !existingEntry) {
    return NextResponse.json(
      { error: "Time entry not found." },
      { status: 404 }
    );
  }

  const now = new Date().toISOString();

  if (mode === "edit") {
    const clockIn = body.clockIn ? String(body.clockIn) : null;
    const breakStart = body.breakStart ? String(body.breakStart) : null;
    const breakEnd = body.breakEnd ? String(body.breakEnd) : null;
    const clockOut = body.clockOut ? String(body.clockOut) : null;
    const adminNote = String(body.adminNote ?? "").trim();

    if (!clockIn) {
      return NextResponse.json(
        { error: "Clock in time is required." },
        { status: 400 }
      );
    }

    if (breakEnd && !breakStart) {
      return NextResponse.json(
        { error: "Break start is required if break end is entered." },
        { status: 400 }
      );
    }

    if (breakStart && breakEnd && new Date(breakEnd) < new Date(breakStart)) {
      return NextResponse.json(
        { error: "Break end cannot be before break start." },
        { status: 400 }
      );
    }

    if (clockOut && new Date(clockOut) < new Date(clockIn)) {
      return NextResponse.json(
        { error: "Clock out cannot be before clock in." },
        { status: 400 }
      );
    }

    if (breakStart && new Date(breakStart) < new Date(clockIn)) {
      return NextResponse.json(
        { error: "Break start cannot be before clock in." },
        { status: 400 }
      );
    }

    if (clockOut && breakEnd && new Date(clockOut) < new Date(breakEnd)) {
      return NextResponse.json(
        { error: "Clock out cannot be before break end." },
        { status: 400 }
      );
    }

    const totalBreakMinutes =
      breakStart && breakEnd ? minutesBetween(breakStart, breakEnd) : 0;

    const totalPaidMinutes = clockOut
      ? Math.max(minutesBetween(clockIn, clockOut) - totalBreakMinutes, 0)
      : 0;

    const updatePayload = {
      clock_in: clockIn,
      break_start: breakStart,
      break_end: breakEnd,
      clock_out: clockOut,
      total_break_minutes: totalBreakMinutes,
      total_paid_minutes: totalPaidMinutes,
      status: "edited",
      admin_note: adminNote || null,
      approved_by: null,
      approved_at: null,
      updated_at: now,
    };

    const { error: updateError } = await supabaseAdmin
      .from("hr_time_entries")
      .update(updatePayload)
      .eq("id", entryId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await createAuditLog({
      supabaseAdmin,
      actorUserId: userId,
      action: "time_entry_edited",
      entityType: "hr_time_entries",
      entityId: entryId,
      details: {
        before: existingEntry,
        after: updatePayload,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Time entry edited. Review and approve it before payroll.",
    });
  }

  const newStatus = String(body.status ?? "").trim() as EntryStatus;
  const adminNote = String(body.adminNote ?? "").trim();

  if (!allowedStatuses.includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const updatePayload = {
    status: newStatus,
    admin_note: adminNote || existingEntry.admin_note || null,
    approved_by: newStatus === "approved" ? userId : null,
    approved_at: newStatus === "approved" ? now : null,
    updated_at: now,
  };

  const { error: updateError } = await supabaseAdmin
    .from("hr_time_entries")
    .update(updatePayload)
    .eq("id", entryId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await createAuditLog({
    supabaseAdmin,
    actorUserId: userId,
    action: `time_entry_${newStatus}`,
    entityType: "hr_time_entries",
    entityId: entryId,
    details: {
      before: existingEntry,
      after: updatePayload,
    },
  });

  return NextResponse.json({
    success: true,
    message: `Time entry marked as ${newStatus}.`,
  });
}