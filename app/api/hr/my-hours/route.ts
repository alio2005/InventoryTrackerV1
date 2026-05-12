import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
    const pin = String(body.pin ?? "").trim();

    if (!employeeCode) {
      return NextResponse.json(
        { error: "Employee code is required." },
        { status: 400 }
      );
    }

    if (!pin) {
      return NextResponse.json(
        { error: "PIN is required." },
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
        status,
        pin_hash
      `
      )
      .eq("employee_code", employeeCode)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN." },
        { status: 401 }
      );
    }

    if (!employee.pin_hash) {
      return NextResponse.json(
        { error: "This employee does not have a PIN set. Please contact HR." },
        { status: 403 }
      );
    }

    if (hashPin(pin) !== employee.pin_hash) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN." },
        { status: 401 }
      );
    }

    const { pin_hash, ...safeEmployee } = employee;

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

    const entryIds = (timeEntries ?? []).map((entry: any) => entry.id);

    let breakSessions: any[] = [];

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
        return NextResponse.json(
          { error: breaksError.message },
          { status: 500 }
        );
      }

      breakSessions = breaks ?? [];
    }

    const timeEntriesWithBreaks = (timeEntries ?? []).map((entry: any) => ({
      ...entry,
      hr_break_sessions: breakSessions.filter(
        (breakSession) => breakSession.time_entry_id === entry.id
      ),
    }));

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
      employee: safeEmployee,
      timeEntries: timeEntriesWithBreaks,
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