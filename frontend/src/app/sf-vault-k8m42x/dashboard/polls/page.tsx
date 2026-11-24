import PrivateStaffPermissionGuard from "@/components/admin/PrivateStaffPermissionGuard";
import PollsManagement from "./polls-management";

export default function PollsPage() {
  return (
    <PrivateStaffPermissionGuard permission="polls:manage">
      <PollsManagement />
    </PrivateStaffPermissionGuard>
  );
}
