import PrivateStaffPermissionGuard from "@/components/admin/PrivateStaffPermissionGuard";
import TriviaManagementTabs from "./trivia-management-tabs";

export default function TriviaPage() {
  return (
    <PrivateStaffPermissionGuard permission="trivia:manage">
      <TriviaManagementTabs />
    </PrivateStaffPermissionGuard>
  );
}
