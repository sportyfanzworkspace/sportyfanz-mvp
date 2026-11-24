import PrivateStaffPermissionGuard from "@/components/admin/PrivateStaffPermissionGuard";
import FanRoomsManagement from "./fanrooms-management";

export default function FanroomsPage() {
  return (
    <PrivateStaffPermissionGuard permission="fanrooms:manage">
      <FanRoomsManagement />
    </PrivateStaffPermissionGuard>
  );
}
