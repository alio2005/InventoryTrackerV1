"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type WorkMode = "in_person" | "wfh" | "off";

type EmployeeSchedule = {
  id?: string;
  employee_id?: string;
  weekday: number;
  work_mode: WorkMode;
  scheduled_start: string | null;
  scheduled_end: string | null;
  grace_minutes: number;
};

type ScheduleFormRow = {
  weekday: number;
  workMode: WorkMode;
  scheduledStart: string;
  scheduledEnd: string;
  graceMinutes: string;
};

type Employee = {
  id: string;
  user_id: string | null;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  work_location: string | null;
  job_title: string | null;
  hourly_rate: number | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  schedules?: EmployeeSchedule[];
};

type EmployeeForm = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  workLocation: string;
  jobTitle: string;
  hourlyRate: string;
  status: string;
  pin: string;
  schedules: ScheduleFormRow[];
};

const weekdays = [
  { weekday: 0, label: "Sunday" },
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
];

function createDefaultSchedules(): ScheduleFormRow[] {
  return weekdays.map((day) => {
    const isWeekday = day.weekday >= 1 && day.weekday <= 5;

    return {
      weekday: day.weekday,
      workMode: isWeekday ? "in_person" : "off",
      scheduledStart: isWeekday ? "09:00" : "",
      scheduledEnd: isWeekday ? "17:00" : "",
      graceMinutes: "5",
    };
  });
}

function createEmptyForm(): EmployeeForm {
  return {
    employeeId: "",
    employeeCode: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    workLocation: "",
    jobTitle: "",
    hourlyRate: "0",
    status: "active",
    pin: "",
    schedules: createDefaultSchedules(),
  };
}

function generateEmployeeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getStatusClass(status: string) {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (status === "inactive") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  }

  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}

function getWorkModeLabel(mode: string) {
  if (mode === "in_person") return "In Person";
  if (mode === "wfh") return "WFH";
  return "Off";
}

function toTimeInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

function mergeEmployeeSchedules(
  schedules: EmployeeSchedule[] | undefined
): ScheduleFormRow[] {
  const defaults = createDefaultSchedules();

  return defaults.map((defaultRow) => {
    const saved = schedules?.find(
      (schedule) => schedule.weekday === defaultRow.weekday
    );

    if (!saved) return defaultRow;

    return {
      weekday: saved.weekday,
      workMode: saved.work_mode || "off",
      scheduledStart:
        saved.work_mode === "off" ? "" : toTimeInput(saved.scheduled_start),
      scheduledEnd:
        saved.work_mode === "off" ? "" : toTimeInput(saved.scheduled_end),
      graceMinutes: String(saved.grace_minutes ?? 5),
    };
  });
}

function getScheduleSummary(employee: Employee) {
  const schedules = employee.schedules ?? [];

  const activeDays = schedules.filter(
    (schedule) => schedule.work_mode !== "off"
  );

  if (activeDays.length === 0) return "No scheduled work days";

  return activeDays
    .map((schedule) => {
      const day = weekdays.find((item) => item.weekday === schedule.weekday);
      return `${day?.label.slice(0, 3)}: ${getWorkModeLabel(
        schedule.work_mode
      )} ${toTimeInput(schedule.scheduled_start)}-${toTimeInput(
        schedule.scheduled_end
      )}`;
    })
    .join(" · ");
}

export default function EmployeesPage() {
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<EmployeeForm>(createEmptyForm());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return employees.filter((employee) => {
      const fullName =
        `${employee.first_name} ${employee.last_name}`.toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        fullName.includes(normalizedSearch) ||
        employee.employee_code.toLowerCase().includes(normalizedSearch) ||
        (employee.email ?? "").toLowerCase().includes(normalizedSearch) ||
        (employee.department ?? "").toLowerCase().includes(normalizedSearch) ||
        (employee.work_location ?? "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (employee.job_title ?? "").toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || employee.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [employees, search, statusFilter]);

  const activeCount = employees.filter(
    (employee) => employee.status === "active"
  ).length;

  const inactiveCount = employees.filter(
    (employee) => employee.status === "inactive"
  ).length;

  const terminatedCount = employees.filter(
    (employee) => employee.status === "terminated"
  ).length;

  const loadEmployees = async (clearFeedback = true) => {
    if (clearFeedback) {
      setError("");
      setMessage("");
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch("/api/hr/employees", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const text = await response.text();

      let result: any = {};
      try {
        result = JSON.parse(text);
      } catch {
        result = { error: text };
      }

      if (!response.ok) {
        setError(result.error || "Unable to load employees.");
        return;
      }

      setEmployees(result.employees || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the employee system."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setMessage("");
    setError("");
  };

  const fillFormForEdit = (employee: Employee) => {
    setForm({
      employeeId: employee.id,
      employeeCode: employee.employee_code,
      firstName: employee.first_name,
      lastName: employee.last_name,
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      department: employee.department ?? "",
      workLocation: employee.work_location ?? "",
      jobTitle: employee.job_title ?? "",
      hourlyRate: String(employee.hourly_rate ?? 0),
      status: employee.status,
      pin: "",
      schedules: mergeEmployeeSchedules(employee.schedules),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateScheduleRow = (
    weekday: number,
    key: keyof ScheduleFormRow,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      schedules: current.schedules.map((schedule) => {
        if (schedule.weekday !== weekday) return schedule;

        if (key === "workMode") {
          const nextMode = value as WorkMode;

          if (nextMode === "off") {
            return {
              ...schedule,
              workMode: nextMode,
              scheduledStart: "",
              scheduledEnd: "",
            };
          }

          return {
            ...schedule,
            workMode: nextMode,
            scheduledStart: schedule.scheduledStart || "09:00",
            scheduledEnd: schedule.scheduledEnd || "17:00",
          };
        }

        return {
          ...schedule,
          [key]: value,
        };
      }),
    }));
  };

  const applyWeekdaySchedule = () => {
    setForm((current) => ({
      ...current,
      schedules: current.schedules.map((schedule) => {
        const isWeekday = schedule.weekday >= 1 && schedule.weekday <= 5;

        if (!isWeekday) {
          return {
            ...schedule,
            workMode: "off",
            scheduledStart: "",
            scheduledEnd: "",
          };
        }

        return {
          ...schedule,
          workMode: "in_person",
          scheduledStart: "09:00",
          scheduledEnd: "17:00",
          graceMinutes: schedule.graceMinutes || "5",
        };
      }),
    }));
  };

  const saveEmployee = async () => {
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const isEditing = Boolean(form.employeeId);

      const response = await fetch("/api/hr/employees", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });

      const text = await response.text();

      let result: any = {};
      try {
        result = JSON.parse(text);
      } catch {
        result = { error: text };
      }

      if (!response.ok) {
        setError(result.error || "Unable to save employee.");
        return;
      }

      setForm(createEmptyForm());
      await loadEmployees(false);
      setMessage(result.message || "Employee saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save this employee."
      );
    } finally {
      setSaving(false);
    }
  };

  const quickUpdateStatus = async (employee: Employee, status: string) => {
    setError("");
    setMessage("");
    setUpdatingId(employee.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch("/api/hr/employees", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          employeeId: employee.id,
          employeeCode: employee.employee_code,
          firstName: employee.first_name,
          lastName: employee.last_name,
          email: employee.email ?? "",
          phone: employee.phone ?? "",
          department: employee.department ?? "",
          workLocation: employee.work_location ?? "",
          jobTitle: employee.job_title ?? "",
          hourlyRate: String(employee.hourly_rate ?? 0),
          status,
          pin: "",
        }),
      });

      const text = await response.text();

      let result: any = {};
      try {
        result = JSON.parse(text);
      } catch {
        result = { error: text };
      }

      if (!response.ok) {
        setError(result.error || "Unable to update employee status.");
        return;
      }

      await loadEmployees(false);
      setMessage(result.message || "Employee status updated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update employee status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <a
          href="/hr"
          className="mb-6 inline-block rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          ← Back to HR
        </a>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              HR Attendance
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              Employee Management
            </h1>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Create employee codes, manage PINs, assign departments, and set
              weekly schedules.
            </p>

            {message && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                {message}
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="mt-8 space-y-5">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Employee Code
                </label>

                <div className="mt-2 flex gap-2">
                  <input
                    value={form.employeeCode}
                    onChange={(event) =>
                      setForm({ ...form, employeeCode: event.target.value })
                    }
                    placeholder="Example: 100001"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        employeeCode: generateEmployeeCode(),
                      })
                    }
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  PIN
                </label>

                <input
                  value={form.pin}
                  onChange={(event) =>
                    setForm({ ...form, pin: event.target.value })
                  }
                  placeholder={
                    form.employeeId
                      ? "Leave blank to keep current PIN"
                      : "Create 4–6 digit PIN"
                  }
                  inputMode="numeric"
                  maxLength={6}
                  type="password"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                />

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  PIN is required for new employees. For existing employees,
                  enter a new PIN only if you want to reset it.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    First Name
                  </label>
                  <input
                    value={form.firstName}
                    onChange={(event) =>
                      setForm({ ...form, firstName: event.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Last Name
                  </label>
                  <input
                    value={form.lastName}
                    onChange={(event) =>
                      setForm({ ...form, lastName: event.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Email
                </label>
                <input
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="employee@example.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Phone
                </label>
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="Optional"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Department
                  </label>
                  <input
                    value={form.department}
                    onChange={(event) =>
                      setForm({ ...form, department: event.target.value })
                    }
                    placeholder="Summer Camp"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Work Location
                  </label>
                  <input
                    value={form.workLocation}
                    onChange={(event) =>
                      setForm({ ...form, workLocation: event.target.value })
                    }
                    placeholder="Markham"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Job Title
                  </label>
                  <input
                    value={form.jobTitle}
                    onChange={(event) =>
                      setForm({ ...form, jobTitle: event.target.value })
                    }
                    placeholder="Camp Staff"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Hourly Rate
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.hourlyRate}
                    onChange={(event) =>
                      setForm({ ...form, hourlyRate: event.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Weekly Schedule</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Set regular work mode and scheduled hours for each day.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={applyWeekdaySchedule}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Mon-Fri 9-5
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {form.schedules.map((schedule) => {
                    const day = weekdays.find(
                      (item) => item.weekday === schedule.weekday
                    );

                    return (
                      <div
                        key={schedule.weekday}
                        className="grid gap-3 rounded-2xl bg-white p-3 dark:bg-slate-900 md:grid-cols-[110px_1fr_1fr_1fr_90px]"
                      >
                        <div className="flex items-center text-sm font-semibold">
                          {day?.label}
                        </div>

                        <select
                          value={schedule.workMode}
                          onChange={(event) =>
                            updateScheduleRow(
                              schedule.weekday,
                              "workMode",
                              event.target.value
                            )
                          }
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="in_person">In Person</option>
                          <option value="wfh">WFH</option>
                          <option value="off">Off</option>
                        </select>

                        <input
                          type="time"
                          value={schedule.scheduledStart}
                          disabled={schedule.workMode === "off"}
                          onChange={(event) =>
                            updateScheduleRow(
                              schedule.weekday,
                              "scheduledStart",
                              event.target.value
                            )
                          }
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                        />

                        <input
                          type="time"
                          value={schedule.scheduledEnd}
                          disabled={schedule.workMode === "off"}
                          onChange={(event) =>
                            updateScheduleRow(
                              schedule.weekday,
                              "scheduledEnd",
                              event.target.value
                            )
                          }
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                        />

                        <input
                          type="number"
                          min="0"
                          value={schedule.graceMinutes}
                          onChange={(event) =>
                            updateScheduleRow(
                              schedule.weekday,
                              "graceMinutes",
                              event.target.value
                            )
                          }
                          title="Grace minutes"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  The last field is grace minutes. Example: 5 means clock-ins up
                  to 5 minutes after scheduled start still count as on time.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={saveEmployee}
                  disabled={
                    saving ||
                    !form.employeeCode ||
                    !form.firstName ||
                    !form.lastName ||
                    (!form.employeeId && !form.pin)
                  }
                  className="flex-1 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : form.employeeId
                    ? "Update Employee"
                    : "Add Employee"}
                </button>

                {form.employeeId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-300 px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                  HR Directory
                </p>

                <h2 className="mt-3 text-2xl font-bold tracking-tight">
                  Employees
                </h2>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  View and update employee profiles used for the time clock.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadEmployees()}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Refresh
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Active
                </p>
                <p className="mt-2 text-2xl font-bold">{activeCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Inactive
                </p>
                <p className="mt-2 text-2xl font-bold">{inactiveCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Terminated
                </p>
                <p className="mt-2 text-2xl font-bold">{terminatedCount}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-[1fr_200px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employees, code, department, location..."
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
                <option value="terminated">Terminated only</option>
              </select>
            </div>

            {loading ? (
              <p className="mt-8 text-sm text-slate-500">
                Loading employees...
              </p>
            ) : filteredEmployees.length === 0 ? (
              <p className="mt-8 text-sm text-slate-500">
                No employees found.
              </p>
            ) : (
              <div className="mt-8 space-y-4">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {employee.first_name} {employee.last_name}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                              employee.status
                            )}`}
                          >
                            {employee.status}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Code: {employee.employee_code}
                        </p>

                        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                          <p>
                            <span className="font-medium">Email:</span>{" "}
                            {employee.email || "—"}
                          </p>
                          <p>
                            <span className="font-medium">Phone:</span>{" "}
                            {employee.phone || "—"}
                          </p>
                          <p>
                            <span className="font-medium">Department:</span>{" "}
                            {employee.department || "—"}
                          </p>
                          <p>
                            <span className="font-medium">Location:</span>{" "}
                            {employee.work_location || "—"}
                          </p>
                          <p>
                            <span className="font-medium">Job Title:</span>{" "}
                            {employee.job_title || "—"}
                          </p>
                          <p>
                            <span className="font-medium">Hourly Rate:</span> $
                            {Number(employee.hourly_rate ?? 0).toFixed(2)}
                          </p>
                        </div>

                        <p className="mt-4 rounded-xl bg-white p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          <span className="font-semibold">Schedule:</span>{" "}
                          {getScheduleSummary(employee)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => fillFormForEdit(employee)}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={updatingId === employee.id}
                          onClick={() => quickUpdateStatus(employee, "active")}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Active
                        </button>

                        <button
                          type="button"
                          disabled={updatingId === employee.id}
                          onClick={() =>
                            quickUpdateStatus(employee, "inactive")
                          }
                          className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                        >
                          Inactive
                        </button>

                        <button
                          type="button"
                          disabled={updatingId === employee.id}
                          onClick={() =>
                            quickUpdateStatus(employee, "terminated")
                          }
                          className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          Terminated
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}