import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AppRole = {
  user_id: string;
  app_key: "global" | "inventory" | "hr";
  role: "admin" | "staff" | "employee";
};

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

async function requireGlobalAdmin(request: Request) {
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
    .eq("app_key", "global")
    .eq("role", "admin");

  if (rolesError) {
    return {
      supabaseAdmin,
      error: rolesError.message,
      status: 500,
      userId: user.id,
    };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isLegacyAdmin = profile?.role === "admin";
  const isGlobalAdmin = Boolean(appRoles && appRoles.length > 0);

  if (!isGlobalAdmin && !isLegacyAdmin) {
    return {
      supabaseAdmin,
      error: "Global admin access required.",
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

function normalizeAccess(roles: AppRole[]) {
  return {
    globalAdmin: roles.some(
      (role) => role.app_key === "global" && role.role === "admin"
    ),
    inventoryAdmin: roles.some(
      (role) => role.app_key === "inventory" && role.role === "admin"
    ),
    hrAdmin: roles.some(
      (role) => role.app_key === "hr" && role.role === "admin"
    ),
    employeeAccess: roles.some(
      (role) => role.app_key === "hr" && role.role === "staff"
    ),
  };
}

export async function GET(request: Request) {
  const { supabaseAdmin, error, status } = await requireGlobalAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  const { data: usersData, error: usersError } =
    await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const users = usersData.users;

  const userIds = users.map((user) => user.id);

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("app_user_roles")
    .select("user_id, app_key, role")
    .in("user_id", userIds);

  if (rolesError) {
    return NextResponse.json({ error: rolesError.message }, { status: 500 });
  }

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .in("id", userIds);

  const result = users.map((user) => {
    const userRoles = (roles ?? []).filter(
      (role) => role.user_id === user.id
    ) as AppRole[];

    const profile = profiles?.find((item) => item.id === user.id);

    return {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      oldProfileRole: profile?.role ?? null,
      roles: userRoles,
      access: normalizeAccess(userRoles),
    };
  });

  return NextResponse.json({
    users: result,
  });
}

export async function PATCH(request: Request) {
  const { supabaseAdmin, error, status, userId } =
    await requireGlobalAdmin(request);

  if (error || !supabaseAdmin) {
    return NextResponse.json({ error }, { status });
  }

  const body = await request.json();

  const targetUserId = String(body.userId ?? "").trim();

  const globalAdmin = Boolean(body.globalAdmin);
  const inventoryAdmin = Boolean(body.inventoryAdmin);
  const hrAdmin = Boolean(body.hrAdmin);
  const employeeAccess = Boolean(body.employeeAccess);

  if (!targetUserId) {
    return NextResponse.json(
      { error: "User ID is required." },
      { status: 400 }
    );
  }

  if (targetUserId === userId && !globalAdmin) {
    return NextResponse.json(
      {
        error:
          "You cannot remove your own Admin for All access from this page.",
      },
      { status: 400 }
    );
  }

  const desiredRoles: Array<{
    user_id: string;
    app_key: "global" | "inventory" | "hr";
    role: "admin" | "staff";
  }> = [];

  if (globalAdmin) {
    desiredRoles.push({
      user_id: targetUserId,
      app_key: "global",
      role: "admin",
    });
  }

  if (inventoryAdmin) {
    desiredRoles.push({
      user_id: targetUserId,
      app_key: "inventory",
      role: "admin",
    });
  }

  if (hrAdmin) {
    desiredRoles.push({
      user_id: targetUserId,
      app_key: "hr",
      role: "admin",
    });
  }

  if (employeeAccess) {
    desiredRoles.push({
      user_id: targetUserId,
      app_key: "hr",
      role: "staff",
    });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("app_user_roles")
    .delete()
    .eq("user_id", targetUserId)
    .in("app_key", ["global", "inventory", "hr"]);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (desiredRoles.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("app_user_roles")
      .insert(desiredRoles);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    message: "User access updated.",
  });
}