import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

type TimeAction = "clock_in" | "break_start" | "break_end" | "clock_out";

const allowedActions: TimeAction[] = [
  "clock_in",
  "break_start",
  "break_end",
  "clock_out",
];

function hashPin(pin: string) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

function getTorontoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function minutesBetween(start: string, end: string) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return 0;
  }

  return Math.max(Math.round((endTime - startTime) / 60000), 0);
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

async function recalculateBreakTotals({
  supabaseAdmin,
  timeEntryId,
  clockIn,
  clockOut,
}: {
  supabaseAdmin: any;
  timeEntryId: string;
  clockIn: string | null;
  clockOut: string | null;
}) {
  const { data: breaks, error: breaksError } = await supabaseAdmin
    .from("hr_break_sessions")
    .select("break_start, break_end, break_minutes")
    .eq("time_entry_id", timeEntryId)
    .order("break_start", { ascending: true });

  if (breaksError) {
    throw new Error(breaksError.message);
  }

  const completedBreaks = breaks ?? [];

  const totalBreakMinutes = completedBreaks.reduce(
    (sum: number, item: any) => sum + Number(item.break_minutes ?? 0),
    0
  );

  const firstBreak = completedBreaks[0] ?? null;
  const lastCompletedBreak =
    completedBreaks
      .filter((item: any) => item.break_end)
      .at(-1) ?? null;

  const totalPaidMinutes =
    clockIn && clockOut
      ? Math.max(minutesBetween(clockIn, clockOut) - totalBreakMinutes, 0)
      : 0;

  const { error: updateError } = await supabaseAdmin
    .from("hr_time_entries")
    .update({
      break_start: firstBreak?.break_start ?? null,
      break_end: lastCompletedBreak?.break_end ?? null,
      total_break_minutes: totalBreakMinutes,
      total_paid_minutes: totalPaidMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", timeEntryId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    totalBreakMinutes,
    totalPaidMinutes,
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "HR time clock API is working",
  });
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            "Missing Supabase server credentials. Check SUPABASE_SERVICE_ROLE_KEY in .env.local.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const employeeCode = String(body.employeeCode ?? "").trim();
    const pin = String(body.pin ?? "").trim();
    const action = String(body.action ?? "") as TimeAction;

    if (!employeeCode) {
      return NextResponse.json(
        { error: "Employee code is required." },
        { status: 400 }
      );
    }

    if (!pin) {
      return NextResponse.json({ error: "PIN is required." }, { status: 400 });
    }

    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        { error: "Invalid time clock action." },
        { status: 400 }
      );
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("hr_employees")
      .select("id, first_name, last_name, status, pin_hash")
      .eq("employee_code", employeeCode)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Invalid employee code or PIN." },
        { status: 401 }
      );
    }

    if (employee.status !== "active") {
      return NextResponse.json(
        { error: "This employee is not active." },
        { status: 403 }
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

    const now = new Date().toISOString();
    const workDate = getTorontoDate();

    const { data: existingEntry, error: existingEntryError } =
      await supabaseAdmin
        .from("hr_time_entries")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("work_date", workDate)
        .maybeSingle();

    if (existingEntryError) {
      return NextResponse.json(
        { error: existingEntryError.message },
        { status: 500 }
      );
    }

    let activeEntry = existingEntry;

    if (action === "clock_in") {
      if (existingEntry?.clock_in) {
        return NextResponse.json(
          { error: "You have already clocked in today." },
          { status: 400 }
        );
      }

      const { data: insertedEntry, error: entryError } = await supabaseAdmin
        .from("hr_time_entries")
        .insert({
          employee_id: employee.id,
          work_date: workDate,
          clock_in: now,
          total_break_minutes: 0,
          total_paid_minutes: 0,
          status: "pending",
        })
        .select("*")
        .single();

      if (entryError) {
        return NextResponse.json({ error: entryError.message }, { status: 500 });
      }

      activeEntry = insertedEntry;
    }

    if (action === "break_start") {
      if (!existingEntry?.clock_in) {
        return NextResponse.json(
          { error: "You must clock in before starting a break." },
          { status: 400 }
        );
      }

      if (existingEntry.clock_out) {
        return NextResponse.json(
          { error: "You have already clocked out today." },
          { status: 400 }
        );
      }

      const { data: openBreak, error: openBreakError } = await supabaseAdmin
        .from("hr_break_sessions")
        .select("id")
        .eq("time_entry_id", existingEntry.id)
        .is("break_end", null)
        .maybeSingle();

      if (openBreakError) {
        return NextResponse.json(
          { error: openBreakError.message },
          { status: 500 }
        );
      }

      if (openBreak) {
        return NextResponse.json(
          { error: "You already have an active break." },
          { status: 400 }
        );
      }

      const { error: breakInsertError } = await supabaseAdmin
        .from("hr_break_sessions")
        .insert({
          time_entry_id: existingEntry.id,
          employee_id: employee.id,
          work_date: workDate,
          break_start: now,
          break_minutes: 0,
        });

      if (breakInsertError) {
        return NextResponse.json(
          { error: breakInsertError.message },
          { status: 500 }
        );
      }

      await recalculateBreakTotals({
        supabaseAdmin,
        timeEntryId: existingEntry.id,
        clockIn: existingEntry.clock_in,
        clockOut: existingEntry.clock_out,
      });

      activeEntry = existingEntry;
    }

    if (action === "break_end") {
      if (!existingEntry?.clock_in) {
        return NextResponse.json(
          { error: "You must clock in first." },
          { status: 400 }
        );
      }

      if (existingEntry.clock_out) {
        return NextResponse.json(
          { error: "You have already clocked out today." },
          { status: 400 }
        );
      }

      const { data: openBreak, error: openBreakError } = await supabaseAdmin
        .from("hr_break_sessions")
        .select("*")
        .eq("time_entry_id", existingEntry.id)
        .is("break_end", null)
        .order("break_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openBreakError) {
        return NextResponse.json(
          { error: openBreakError.message },
          { status: 500 }
        );
      }

      if (!openBreak) {
        return NextResponse.json(
          { error: "You must start a break before ending a break." },
          { status: 400 }
        );
      }

      const breakMinutes = minutesBetween(openBreak.break_start, now);

      const { error: breakUpdateError } = await supabaseAdmin
        .from("hr_break_sessions")
        .update({
          break_end: now,
          break_minutes: breakMinutes,
          updated_at: now,
        })
        .eq("id", openBreak.id);

      if (breakUpdateError) {
        return NextResponse.json(
          { error: breakUpdateError.message },
          { status: 500 }
        );
      }

      await recalculateBreakTotals({
        supabaseAdmin,
        timeEntryId: existingEntry.id,
        clockIn: existingEntry.clock_in,
        clockOut: existingEntry.clock_out,
      });

      activeEntry = existingEntry;
    }

    if (action === "clock_out") {
      if (!existingEntry?.clock_in) {
        return NextResponse.json(
          { error: "You must clock in before clocking out." },
          { status: 400 }
        );
      }

      if (existingEntry.clock_out) {
        return NextResponse.json(
          { error: "You have already clocked out today." },
          { status: 400 }
        );
      }

      const { data: openBreak, error: openBreakError } = await supabaseAdmin
        .from("hr_break_sessions")
        .select("id")
        .eq("time_entry_id", existingEntry.id)
        .is("break_end", null)
        .maybeSingle();

      if (openBreakError) {
        return NextResponse.json(
          { error: openBreakError.message },
          { status: 500 }
        );
      }

      if (openBreak) {
        return NextResponse.json(
          { error: "You must end your active break before clocking out." },
          { status: 400 }
        );
      }

      const { error: clockOutError } = await supabaseAdmin
        .from("hr_time_entries")
        .update({
          clock_out: now,
          updated_at: now,
          status: "pending",
        })
        .eq("id", existingEntry.id);

      if (clockOutError) {
        return NextResponse.json(
          { error: clockOutError.message },
          { status: 500 }
        );
      }

      await recalculateBreakTotals({
        supabaseAdmin,
        timeEntryId: existingEntry.id,
        clockIn: existingEntry.clock_in,
        clockOut: now,
      });

      activeEntry = {
        ...existingEntry,
        clock_out: now,
      };
    }

    if (activeEntry) {
      const { error: eventError } = await supabaseAdmin
        .from("hr_time_events")
        .insert({
          employee_id: employee.id,
          event_type: action,
          event_time: now,
        });

      if (eventError) {
        return NextResponse.json({ error: eventError.message }, { status: 500 });
      }
    }

    const actionLabels: Record<TimeAction, string> = {
      clock_in: "clocked in",
      break_start: "started break",
      break_end: "ended break",
      clock_out: "clocked out",
    };

    return NextResponse.json({
      success: true,
      message: `${employee.first_name} ${employee.last_name} ${actionLabels[action]} successfully.`,
    });
  } catch (error) {
    console.error("Time clock API error:", error);

    return NextResponse.json(
      { error: "Something went wrong while recording the time event." },
      { status: 500 }
    );
  }
}