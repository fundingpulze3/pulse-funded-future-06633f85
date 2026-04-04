import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient.rpc("get_user_role", { _user_id: user.id });
    if (!roleData || !["administrator", "admin"].includes(roleData)) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { emails } = await req.json();
    if (!Array.isArray(emails) || emails.length === 0 || emails.length > 200) {
      return new Response(JSON.stringify({ error: "Provide 1-200 emails" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const email of emails) {
      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        results.push({ email: trimmed, status: "error", message: "Invalid email" });
        continue;
      }

      // Check if user already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const exists = existingUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === trimmed
      );

      if (exists) {
        results.push({ email: trimmed, status: "exists", message: "Already exists" });
        continue;
      }

      // Create user with random password
      const randomPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { error } = await adminClient.auth.admin.createUser({
        email: trimmed,
        password: randomPassword,
        email_confirm: true,
      });

      if (error) {
        if (error.message?.includes("already been registered") || error.message?.includes("already exists")) {
          results.push({ email: trimmed, status: "exists", message: "Already exists" });
        } else {
          results.push({ email: trimmed, status: "error", message: error.message });
        }
      } else {
        results.push({ email: trimmed, status: "success", message: "Created" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
