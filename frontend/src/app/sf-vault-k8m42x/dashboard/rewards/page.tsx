import PrivateStaffPermissionGuard from "@/components/admin/PrivateStaffPermissionGuard";
import RewardsManagement from "./rewards-management";

export default function RewardsPage() {
  return (
    <PrivateStaffPermissionGuard permission="rewards:manage">
      <RewardsManagement />
    </PrivateStaffPermissionGuard>
  );
}
