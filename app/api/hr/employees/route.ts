import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

type EmployeeStatus = "active" | "inactive" | "terminated";
type WorkMode = "in_person" | "wfh" | "off";

const allowedStatuses: EmployeeStatus[] = ["active", "inactive", "terminated"];
const allowedWorkModes: WorkMode[] = ["in_person", "wfh", "off"];

type ScheduleInput = {
  weekday: number;
  workMode?: string;
  work_mode?: string;
  scheduledStart?: string;
  scheduled_start?: string;
  scheduledEnd?: string;
  scheduled_end?: string;
  graceMinutes?: number;
  grace_minutes?: number;
};

function hashPin(pin: string) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

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

function normalizeTime(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) return null;

  // Accepts "09:00" or "09:00:00"
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function buildScheduleRows(employeeId: string, rawSchedules: ScheduleInput[]) {
  const scheduleByWeekday = new Map<number, ScheduleInput>();

  rawSchedules.forEach((schedule) => {
    const weekday = Number(schedule.weekday);

    if (weekday >= 0 && weekday <= 6) {
      scheduleByWeekday.set(weekday, schedule);
    }
  });

  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const schedule = scheduleByWeekday.get(weekday);

    const rawWorkMode = String(
      schedule?.workMode ?? schedule?.work_mode ?? "off"
    ).trim() as WorkMode;

    const workMode: WorkMode = allowedWorkModes.includes(rawWorkMode)
      ? rawWorkMode
      : "off";

    const scheduledStart =
      workMode === "off"
        ? null
        : normalizeTime(schedule?.scheduledStart ?? schedule?.scheduled_start);

    const scheduledEnd =
      workMode === "off"
        ? null
        : normalizeTime(schedule?.scheduledEnd ?? schedule?.scheduled_end);

    const graceMinutes = Number(
      schedule?.graceMinutes ?? schedule?.grace_minutes ?? 5
    );

    return {
      employee_id: employeeId,
      weekday,
      work_mode: workMode,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      grace_minutes:
        Number.isFinite(graceMinutes) && graceMinutes >= 0 ? graceMinutes : 5,
      updated_at: new Date().toISOString(),
    };
  });
}

async function saveEmployeeSchedule({
  supabaseAdmin,
  employeeId,
  schedules,
}: {
  supabaseAdmin: any;
  employeeId: string;
  schedules: ScheduleInput[];
}) {
  const rows = buildScheduleRows(employeeId, schedules);

  const { error } = await supabaseAdmin
    .from("hr_employee_schedules")
    .upsert(rows, {
      onConflict: "employee_id,weekday",
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function attachSchedulesToEmployees({
  supabaseAdmin,
  employees,
}: {
  supabaseAdmin: any;
  employees: any[];
}) {
  const employeeIds = employees.map((employee) => employee.id);

  if (employeeIds.length === 0) {
    return employees;
  }

  const { data: schedules, error: schedulesError } = await supabaseAdmin
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
    throw new Error(schedulesError.message);
  }

  return employees.map((employee) => ({
    ...employee,
    schedules: (schedules ?? []).filter(
      (schedule: any) => schedule.employee_id === employee.id
    ),
  }));
}

export async function GET(request: Request) {
  const { supabaseAdmin, error, status } = await requireHRAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from("hr_employees")
      .select(
        `
        id,
        user_id,
        employee_code,
        first_name,
        last_name,
        email,
        phone,
        department,
        work_location,
        job_title,
        hourly_rate,
        status,
        created_at,
        updated_at
      `
      )
      .order("created_at", { ascending: false });

    if (employeesError) {
      return NextResponse.json(
        { error: employeesError.message },
        { status: 500 }
      );
    }

    const employeesWithSchedules = await attachSchedulesToEmployees({
      supabaseAdmin,
      employees: employees ?? [],
    });

    return NextResponse.json({ employees: employeesWithSchedules });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unable to load employee schedules.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { supabaseAdmin, error, status } = await requireHRAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await request.json();

    const employeeCode = String(body.employeeCode ?? "").trim();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const department = String(body.department ?? "").trim();
    const workLocation = String(body.workLocation ?? "").trim();
    const jobTitle = String(body.jobTitle ?? "").trim();
    const hourlyRate = Number(body.hourlyRate ?? 0);
    const employeeStatus = String(
      body.status ?? "active"
    ).trim() as EmployeeStatus;
    const pin = String(body.pin ?? "").trim();
    const schedules = Array.isArray(body.schedules) ? body.schedules : [];

    if (!employeeCode) {
      return NextResponse.json(
        { error: "Employee code is required." },
        { status: 400 }
      );
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required." },
        { status: 400 }
      );
    }

    if (!pin || pin.length < 4 || pin.length > 6) {
      return NextResponse.json(
        { error: "A 4–6 digit PIN is required." },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must contain numbers only." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(employeeStatus)) {
      return NextResponse.json(
        { error: "Invalid employee status." },
        { status: 400 }
      );
    }

    if (Number.isNaN(hourlyRate) || hourlyRate < 0) {
      return NextResponse.json(
        { error: "Hourly rate must be a valid number." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: insertedEmployee, error: insertError } = await supabaseAdmin
      .from("hr_employees")
      .insert({
        employee_code: employeeCode,
        pin_hash: hashPin(pin),
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone: phone || null,
        department: department || null,
        work_location: workLocation || null,
        job_title: jobTitle || null,
        hourly_rate: hourlyRate,
        status: employeeStatus,
        updated_at: now,
      })
      .select(
        `
        id,
        employee_code,
        first_name,
        last_name
      `
      )
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await saveEmployeeSchedule({
      supabaseAdmin,
      employeeId: insertedEmployee.id,
      schedules,
    });

    return NextResponse.json({
      success: true,
      message: `${firstName} ${lastName} was added as an employee.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unable to save employee.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { supabaseAdmin, error, status } = await requireHRAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await request.json();

    const employeeId = String(body.employeeId ?? "").trim();
    const employeeCode = String(body.employeeCode ?? "").trim();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const department = String(body.department ?? "").trim();
    const workLocation = String(body.workLocation ?? "").trim();
    const jobTitle = String(body.jobTitle ?? "").trim();
    const hourlyRate = Number(body.hourlyRate ?? 0);
    const employeeStatus = String(
      body.status ?? "active"
    ).trim() as EmployeeStatus;
    const pin = String(body.pin ?? "").trim();
    const schedules = Array.isArray(body.schedules) ? body.schedules : null;

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required." },
        { status: 400 }
      );
    }

    if (!employeeCode) {
      return NextResponse.json(
        { error: "Employee code is required." },
        { status: 400 }
      );
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required." },
        { status: 400 }
      );
    }

    if (pin && (!/^\d+$/.test(pin) || pin.length < 4 || pin.length > 6)) {
      return NextResponse.json(
        { error: "PIN must be 4–6 digits." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(employeeStatus)) {
      return NextResponse.json(
        { error: "Invalid employee status." },
        { status: 400 }
      );
    }

    if (Number.isNaN(hourlyRate) || hourlyRate < 0) {
      return NextResponse.json(
        { error: "Hourly rate must be a valid number." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const updatePayload: Record<string, unknown> = {
      employee_code: employeeCode,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      department: department || null,
      work_location: workLocation || null,
      job_title: jobTitle || null,
      hourly_rate: hourlyRate,
      status: employeeStatus,
      updated_at: now,
    };

    if (pin) {
      updatePayload.pin_hash = hashPin(pin);
    }

    const { error: updateError } = await supabaseAdmin
      .from("hr_employees")
      .update(updatePayload)
      .eq("id", employeeId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (schedules) {
      await saveEmployeeSchedule({
        supabaseAdmin,
        employeeId,
        schedules,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${firstName} ${lastName}'s employee profile was updated.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unable to update employee.",
      },
      { status: 500 }
    );
  }
}