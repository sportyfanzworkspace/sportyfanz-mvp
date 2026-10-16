
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/admin/require-admin";
import RewardsManagement from "./rewards-management";

export default async function RewardsPage() {
  const auth = await requirePermission("rewards:manage");

  if (!auth.authorized) {
    if (auth.reason === "password_change_required") {
      redirect("/admin/change-password");
    }

    if (auth.reason === "unauthenticated") {
      redirect("/admin/login");
    }

    redirect("/admin/dashboard");
  }

  return <RewardsManagement />;
}
