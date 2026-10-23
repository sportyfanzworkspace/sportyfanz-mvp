import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/admin/require-admin";
import PlayersManagement from "./players-management";

export default async function PlayersPage() {
  const auth = await requirePermission("players:manage");

  if (!auth.authorized) {
    if (auth.reason === "password_change_required") {
      redirect("/admin/change-password");
    }

    if (auth.reason === "unauthenticated") {
      redirect("/admin/login");
    }

    redirect("/admin/dashboard");
  }

  return <PlayersManagement />;
}