import PrivateStaffPermissionGuard from "@/components/admin/PrivateStaffPermissionGuard";
import FansManagement from "./fans-management";

export default function FansPage() {
  return (
    <PrivateStaffPermissionGuard permission="fans:support">
      <FansManagement />
    </PrivateStaffPermissionGuard>
  );
}
