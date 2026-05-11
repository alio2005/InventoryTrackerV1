import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RequestType = "sick" | "vacation" | "unpaid" | "emergency" | "other";
type RequestStatus = "pending" | "approved" | "denied" | "cancelled";

const allowedTypes: RequestType[] = [
  "sick",
  "vacation",
  "unpaid",
  "emergency",
  "other",
];

const allowedStatuses: RequestStatus[] = [
  "pending",
  "approved",
  "denied",
  "cancelled",
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

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Missing Supabase server credentials." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const employeeCode = String(body.employeeCode ?? "").trim();
    const requestType = String(body.requestType ?? "").trim() as RequestType;
    const startDate = String(body.startDate ?? "").trim();
    const endDate = String(body.endDate ?? "").trim();
    const reason = String(body.reason ?? "").trim();

    if (!employeeCode) {
      return NextResponse.json(
        { error: "Employee code is required." },
        { status: 400 }
      );
    }

    if (!allowedTypes.includes(requestType)) {
      return NextResponse.json(
        { error: "Invalid request type." },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required." },
        { status: 400 }
      );
    }

    if (new Date(endDate) < new Date(startDate)) {
      return NextResponse.json(
        { error: "End date cannot be before start date." },
        { status: 400 }
      );
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("hr_employees")
      .select("id, first_name, last_name, status")
      .eq("employee_code", employeeCode)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Employee code not found." },
        { status: 404 }
      );
    }

    if (employee.status !== "active") {
      return NextResponse.json(
        { error: "This employee is not active." },
        { status: 403 }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("hr_time_off_requests")
      .insert({
        employee_id: employee.id,
        request_type: requestType,
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
        status: "pending",
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${employee.first_name} ${employee.last_name}'s time-off request was submitted.`,
    });
  } catch (error) {
    console.error("Time-off request error:", error);

    return NextResponse.json(
      { error: "Something went wrong while submitting the request." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { supabaseAdmin, error, status } = await requireAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  const { data: requests, error: requestsError } = await supabaseAdmin
    .from("hr_time_off_requests")
    .select(
      `
      id,
      employee_id,
      request_type,
      start_date,
      end_date,
      reason,
      status,
      admin_note,
      reviewed_at,
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
    .order("created_at", { ascending: false });

  if (requestsError) {
    return NextResponse.json({ error: requestsError.message }, { status: 500 });
  }

  return NextResponse.json({ requests: requests ?? [] });
}

export async function PATCH(request: Request) {
  const { supabaseAdmin, error, status, userId } = await requireAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  const body = await request.json();

  const requestId = String(body.requestId ?? "").trim();
  const newStatus = String(body.status ?? "").trim() as RequestStatus;
  const adminNote = String(body.adminNote ?? "").trim();

  if (!requestId) {
    return NextResponse.json(
      { error: "Request ID is required." },
      { status: 400 }
    );
  }

  if (!allowedStatuses.includes(newStatus)) {
    return NextResponse.json(
      { error: "Invalid request status." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("hr_time_off_requests")
    .update({
      status: newStatus,
      admin_note: adminNote || null,
      reviewed_by: userId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", requestId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Request marked as ${newStatus}.`,
  });
}