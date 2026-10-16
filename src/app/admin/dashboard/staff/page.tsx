import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/admin/require-admin";
import StaffManagement from "./staff-management";

export default async function StaffPage() {
  const result = await requirePermission("staff:manage");

if (!result.authorized) {
  if (result.reason === "password_change_required") {
    redirect("/admin/change-password");
  }

  if (result.reason === "unauthenticated") {
    redirect("/admin/login");
  }

  redirect("/admin/dashboard");
}

  return (
    <main className="staff-page">
      <header className="staff-header">
        <div>
          <p className="staff-eyebrow">SPORTYFANZ OPERATIONS</p>
          <h1>Staff Management</h1>
          <p className="staff-description">
            Create staff accounts and manage access to the internal workspace.
          </p>
        </div>
        <a href="/admin/dashboard" className="staff-back">
          ← Dashboard
        </a>
      </header>

      <StaffManagement />

      <footer className="staff-footer">
        SportyFanz Internal Administration · Authorised staff only
      </footer>

      <style>{`
        .staff-page {
          min-height: 100vh;
          padding: 42px;
          box-sizing: border-box;
          background: #10121b;
          color: #f7f8fc;
          font-family: Lato, Arial, sans-serif;
        }
        .staff-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 32px;
        }
        .staff-eyebrow {
          color: #f5b82e;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.7px;
        }
        .staff-header h1 {
          margin: 10px 0;
          font-size: clamp(28px, 4vw, 36px);
        }
        .staff-description { color: #a3a9bd; line-height: 1.7; }
        .staff-back {
          color: #f5b82e;
          text-decoration: none;
          border: 1px solid #3a3e4e;
          border-radius: 9px;
          padding: 12px 16px;
          white-space: nowrap;
        }
        .staff-back:hover { background: #282c3c; }
        .staff-footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #292d3d;
          color: #8e95aa;
          font-size: 12px;
        }
        @media (max-width: 640px) {
          .staff-page { padding: 24px 16px; }
          .staff-header { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}
