import PrivateStaffPermissionGuard from "@/components/admin/PrivateStaffPermissionGuard";
import TriviaManagement from "./trivia-management";

export default function TriviaPage() {
  return (
    <PrivateStaffPermissionGuard permission="trivia:manage">
      <TriviaManagement />
    </PrivateStaffPermissionGuard>
  );
}
