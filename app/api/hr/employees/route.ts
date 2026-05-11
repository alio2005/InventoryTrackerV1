import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type EmployeeStatus = "active" | "inactive" | "terminated";

const allowedStatuses: EmployeeStatus[] = ["active", "inactive", "terminated"];

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

async function requireAdmin(request: Request) {
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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      supabaseAdmin,
      error: "Admin access required.",
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
  const { supabaseAdmin, error, status } = await requireAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

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
    return NextResponse.json({ error: employeesError.message }, { status: 500 });
  }

  return NextResponse.json({ employees: employees ?? [] });
}

export async function POST(request: Request) {
  const { supabaseAdmin, error, status } = await requireAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

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
  const employeeStatus = String(body.status ?? "active").trim() as EmployeeStatus;

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

  const { error: insertError } = await supabaseAdmin.from("hr_employees").insert({
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
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `${firstName} ${lastName} was added as an employee.`,
  });
}

export async function PATCH(request: Request) {
  const { supabaseAdmin, error, status } = await requireAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

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
  const employeeStatus = String(body.status ?? "active").trim() as EmployeeStatus;

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

  const { error: updateError } = await supabaseAdmin
    .from("hr_employees")
    .update({
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
    })
    .eq("id", employeeId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `${firstName} ${lastName}'s employee profile was updated.`,
  });
}