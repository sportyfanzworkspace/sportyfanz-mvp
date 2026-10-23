
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/admin/require-admin";
import FanRoomsManagement from "./fanrooms-management";

export default async function FanRoomsPage() {
  const auth = await requirePermission("fanrooms:manage");

  if (!auth.authorized) {
    if (auth.reason === "password_change_required") {
      redirect("/admin/change-password");
    }

    if (auth.reason === "unauthenticated") {
      redirect("/admin/login");
    }

    redirect("/admin/dashboard");
  }

  return <FanRoomsManagement />;
}
