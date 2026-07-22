import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteForm } from "./invite-form";
import { MemberRow } from "./member-row";

export default async function StaffPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/inventory");

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .order("role");

  const ownerCount = (members ?? []).filter((m) => m.role === "owner").length;

  // profiles doesn't store email; look it up via the admin API for display.
  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers();
  const emailById = new Map(userList?.users.map((u) => [u.id, u.email ?? ""]));
  const pendingById = new Map(userList?.users.map((u) => [u.id, !u.last_sign_in_at]));

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-serif text-2xl font-normal text-ink">Staff</h1>

      <div className="stagger mt-6 flex flex-col gap-3">
        {(members ?? []).map((m) => (
          <MemberRow
            key={m.id}
            profileId={m.id}
            displayName={m.display_name}
            email={emailById.get(m.id) ?? "unknown"}
            role={m.role}
            isCurrentUser={m.id === profile.id}
            canDemoteOrRemove={m.role !== "owner" || ownerCount > 1}
            pending={pendingById.get(m.id) ?? false}
          />
        ))}
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Invite staff</h2>
      <div className="mt-2">
        <InviteForm />
      </div>
    </main>
  );
}
