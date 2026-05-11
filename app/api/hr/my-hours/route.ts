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
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Missing Supabase server credentials." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeCode = String(searchParams.get("employeeCode") ?? "").trim();

    if (!employeeCode) {
      return NextResponse.json(
        { error: "Employee code is required." },
        { status: 400 }
      );
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("hr_employees")
      .select(
        `
        id,
        employee_code,
        first_name,
        last_name,
        email,
        department,
        work_location,
        job_title,
        status
      `
      )
      .eq("employee_code", employeeCode)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Employee code not found." },
        { status: 404 }
      );
    }

    const { data: timeEntries, error: entriesError } = await supabaseAdmin
      .from("hr_time_entries")
      .select(
        `
        id,
        work_date,
        clock_in,
        break_start,
        break_end,
        clock_out,
        total_break_minutes,
        total_paid_minutes,
        status,
        admin_note,
        created_at
      `
      )
      .eq("employee_id", employee.id)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }

    const { data: timeOffRequests, error: requestsError } = await supabaseAdmin
      .from("hr_time_off_requests")
      .select(
        `
        id,
        request_type,
        start_date,
        end_date,
        reason,
        status,
        admin_note,
        reviewed_at,
        created_at
      `
      )
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });

    if (requestsError) {
      return NextResponse.json(
        { error: requestsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      employee,
      timeEntries: timeEntries ?? [],
      timeOffRequests: timeOffRequests ?? [],
    });
  } catch (error) {
    console.error("My hours API error:", error);

    return NextResponse.json(
      { error: "Something went wrong while loading employee records." },
      { status: 500 }
    );
  }
}