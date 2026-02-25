import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface SignUpPayload {
  email?: string;
  password?: string;
  firstName?: string;
  inviteCode?: string;
}

function normalizeEmail(rawEmail: string) {
  return rawEmail.trim().toLowerCase();
}

function isAllowedDomain(email: string, allowedDomains: string[]) {
  if (allowedDomains.length === 0) {
    return true;
  }

  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) {
    return false;
  }

  const domain = email.slice(atIndex + 1);
  return allowedDomains.includes(domain);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SignUpPayload;
  const email = normalizeEmail(body.email ?? "");
  const password = body.password?.trim() ?? "";
  const firstName = body.firstName?.trim() ?? "";
  const inviteCode = body.inviteCode?.trim() ?? "";

  if (!email || !password || !inviteCode) {
    return NextResponse.json(
      { error: "Email, password, and invite code are required." },
      { status: 400 }
    );
  }

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const expectedInviteCode = process.env.TEAM_INVITE_CODE;
  if (!expectedInviteCode) {
    return NextResponse.json(
      { error: "Team signup is not configured yet." },
      { status: 500 }
    );
  }

  if (inviteCode !== expectedInviteCode) {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
  }

  const allowedDomains = (process.env.ALLOWED_SIGNUP_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  if (!isAllowedDomain(email, allowedDomains)) {
    return NextResponse.json(
      { error: "Email domain is not allowed for team signup." },
      { status: 403 }
    );
  }

  const adminClient = createSupabaseAdminClient();
  const fallbackName = email.split("@")[0] ?? "user";

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName || fallbackName
    }
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already")) {
      return NextResponse.json(
        { error: "Account already exists. Sign in with password." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
