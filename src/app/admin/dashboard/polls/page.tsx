import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/admin/require-admin";
import PollsManagement from "./polls-management";

export default async function PollsPage() {
  const auth = await requirePermission("polls:manage");

  if (!auth.authorized) {
    if (auth.reason === "password_change_required") {
      redirect("/admin/change-password");
    }

    if (auth.reason === "unauthenticated") {
      redirect("/admin/login");
    }

    redirect("/admin/dashboard");
  }

  return <PollsManagement />;
}