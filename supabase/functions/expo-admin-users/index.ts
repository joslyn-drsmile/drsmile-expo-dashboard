import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "https://drsmile-expo-dashboard.vercel.app",
  "https://joslyn-drsmile.github.io",
]);
const roles = new Set(["admin", "customer_service", "after_sales", "marketer", "staff"]);

function response(origin: string, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (!allowedOrigins.has(origin)) return response("null", { error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }
  if (req.method !== "POST") return response(origin, { error: "Method not allowed" }, 405);

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const callerEmail = authData.user?.email?.toLowerCase();
  if (authError || !callerEmail) return response(origin, { error: "Unauthorized" }, 401);

  const { data: caller } = await admin.from("expo_allowed_users").select("active, role").eq("email", callerEmail).maybeSingle();
  if (!caller?.active || caller.role !== "admin") return response(origin, { error: "Administrator access required" }, 403);

  const body = await req.json().catch(() => ({}));
  if (body.action === "list") {
    const [{ data: approved, error: approvedError }, { data: authUsers, error: usersError }] = await Promise.all([
      admin.from("expo_allowed_users").select("email, display_name, role, active").order("display_name"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (approvedError || usersError) return response(origin, { error: approvedError?.message ?? usersError?.message }, 400);
    const authByEmail = new Map((authUsers.users ?? []).map((user) => [user.email?.toLowerCase(), user]));
    return response(origin, { users: (approved ?? []).map((user) => {
      const authUser = authByEmail.get(user.email);
      return { email: user.email, displayName: user.display_name, role: user.role, active: user.active, accountCreated: Boolean(authUser), lastSignInAt: authUser?.last_sign_in_at ?? null };
    }) });
  }

  if (body.action === "create") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.displayName ?? "").trim();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "staff");
    if (!/^\S+@\S+\.\S+$/.test(email) || !displayName || password.length < 8 || !roles.has(role)) {
      return response(origin, { error: "Valid name, email, role and a password with at least 8 characters are required." }, 400);
    }
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { expo_role: role },
      user_metadata: { display_name: displayName },
    });
    if (createError) return response(origin, { error: createError.message }, 400);
    const { error: approvalError } = await admin.from("expo_allowed_users").upsert({ email, display_name: displayName, role, active: true }, { onConflict: "email" });
    if (approvalError) {
      if (created.user) await admin.auth.admin.deleteUser(created.user.id);
      return response(origin, { error: approvalError.message }, 400);
    }
    return response(origin, { created: true }, 201);
  }

  return response(origin, { error: "Unknown action" }, 400);
});
