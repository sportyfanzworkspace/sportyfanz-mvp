import PrivateStaffPermissionGuard from "@/components/admin/PrivateStaffPermissionGuard";
import DiscoveryManagement from "./discovery-management";

export default function DiscoveryPage() {
  return (
    <PrivateStaffPermissionGuard permission="discovery:manage">
      <DiscoveryManagement />
    </PrivateStaffPermissionGuard>
  );
}
