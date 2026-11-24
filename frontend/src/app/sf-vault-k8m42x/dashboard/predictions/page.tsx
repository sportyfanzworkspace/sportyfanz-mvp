import PrivateStaffPermissionGuard from "@/components/admin/PrivateStaffPermissionGuard";
import PredictionsManagement from "./predictions-management";

export default function PredictionsPage() {
  return (
    <PrivateStaffPermissionGuard permission="predictions:manage">
      <PredictionsManagement />
    </PrivateStaffPermissionGuard>
  );
}
