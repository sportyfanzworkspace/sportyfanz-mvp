
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/admin/require-admin";
import TriviaManagement from "./trivia-management";

export default async function TriviaPage() {
  const auth = await requirePermission("trivia:manage");

  if (!auth.authorized) {
    if (auth.reason === "password_change_required") {
      redirect("/admin/change-password");
    }

    if (auth.reason === "unauthenticated") {
      redirect("/admin/login");
    }

    redirect("/admin/dashboard");
  }

  return <TriviaManagement />;
}
