import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AssignmentStatus } from "@/lib/types";

interface DeadlineDeal {
  id: string;
  address: string;
  dd_deadline: string;
  assignment_status: AssignmentStatus;
  created_by: string;
  acq_manager_first_name: string;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function hoursLeft(deadlineDate: string) {
  const deadline = new Date(`${deadlineDate}T23:59:59`);
  return Math.max(0, Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60)));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.RESEND_API_KEY
  ) {
    return NextResponse.json(
      { error: "Missing required server environment variables" },
      { status: 500 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);

  const today = new Date();
  const inTwoDays = new Date(today);
  inTwoDays.setDate(today.getDate() + 2);

  const { data: deadlineDeals, error: dealsError } = await supabase
    .from("deals")
    .select(
      "id,address,dd_deadline,assignment_status,created_by,acq_manager_first_name"
    )
    .gte("dd_deadline", isoDate(today))
    .lte("dd_deadline", isoDate(inTwoDays));

  if (dealsError) {
    return NextResponse.json(
      { error: `Failed to query deals: ${dealsError.message}` },
      { status: 500 }
    );
  }

  if (!deadlineDeals || deadlineDeals.length === 0) {
    return NextResponse.json({ ok: true, emailsSent: 0, dealsFound: 0 });
  }

  const { data: admins, error: adminsError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (adminsError) {
    return NextResponse.json(
      { error: `Failed to query admin roles: ${adminsError.message}` },
      { status: 500 }
    );
  }

  const fallbackAdminEmails = (process.env.ADMIN_ALERT_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  const adminEmailsFromRoles: string[] = [];

  for (const admin of admins ?? []) {
    const { data } = await supabase.auth.admin.getUserById(admin.user_id);
    if (data.user?.email) {
      adminEmailsFromRoles.push(data.user.email);
    }
  }

  const adminEmails = Array.from(
    new Set([...adminEmailsFromRoles, ...fallbackAdminEmails])
  );

  const sent: Array<{ dealId: string; recipients: string[] }> = [];

  for (const deal of deadlineDeals as DeadlineDeal[]) {
    let recipients: string[] = [];

    if (deal.assignment_status === "Not Assigned") {
      recipients = adminEmails;
    } else {
      const { data } = await supabase.auth.admin.getUserById(deal.created_by);
      const assignedEmail = data.user?.email;
      recipients = assignedEmail ? [assignedEmail] : adminEmails;
    }

    if (recipients.length === 0) {
      continue;
    }

    const left = hoursLeft(deal.dd_deadline);

    const { error: emailError } = await resend.emails.send({
      from: process.env.ALERT_FROM_EMAIL || "onboarding@resend.dev",
      to: recipients,
      subject: `DD Deadline Alert: ${deal.address}`,
      html: `<p><strong>Deal:</strong> ${deal.address}</p>
             <p><strong>Acq Manager:</strong> ${deal.acq_manager_first_name}</p>
             <p><strong>DD Deadline:</strong> ${deal.dd_deadline}</p>
             <p><strong>Time Remaining:</strong> ~${left} hours</p>
             <p>Open Cedar Deal Dashboard and take action.</p>`
    });

    if (emailError) {
      return NextResponse.json(
        { error: `Resend failed: ${emailError.message}` },
        { status: 500 }
      );
    }

    sent.push({ dealId: deal.id, recipients });
  }

  return NextResponse.json({
    ok: true,
    dealsFound: deadlineDeals.length,
    emailsSent: sent.length,
    sent
  });
}
