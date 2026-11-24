import PrivateStaffPermissionGuard from "@/components/admin/PrivateStaffPermissionGuard";
import PlayersManagement from "./players-management";

export default function PlayersPage() {
  return (
    <PrivateStaffPermissionGuard permission="players:manage">
      <PlayersManagement />
    </PrivateStaffPermissionGuard>
  );
}
