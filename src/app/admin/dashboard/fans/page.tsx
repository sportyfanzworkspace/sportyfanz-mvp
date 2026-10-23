
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/admin/require-admin";
import FansManagement from "./fans-management";

export default async function FansPage() {
  const auth = await requirePermission("fans:support");

  if (!auth.authorized) {
    if (auth.reason === "password_change_required") {
      redirect("/admin/change-password");
    }

    if (auth.reason === "unauthenticated") {
      redirect("/admin/login");
    }

    redirect("/admin/dashboard");
  }

  return <FansManagement />;
}
