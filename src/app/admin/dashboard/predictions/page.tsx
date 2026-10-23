
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/admin/require-admin";
import PredictionsManagement from "./predictions-management";

export default async function PredictionsPage() {
  const auth = await requirePermission("predictions:manage");

  if (!auth.authorized) {
    if (auth.reason === "password_change_required") {
      redirect("/admin/change-password");
    }

    if (auth.reason === "unauthenticated") {
      redirect("/admin/login");
    }

    redirect("/admin/dashboard");
  }

  return <PredictionsManagement />;
}
