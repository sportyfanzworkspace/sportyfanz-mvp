import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/admin/require-admin";
import KycManagement from "./kyc-management";

export default async function KycPage() {
  const result = await requirePermission("kyc:manage");

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
    <main className="kyc-page">
      <header className="kyc-header">
        <div>
          <p className="kyc-eyebrow">SPORTYFANZ OPERATIONS</p>
          <h1>KYC Review</h1>
          <p className="kyc-description">
            Review fan submissions and approve or reject their KYC details.
            Approved submissions receive 40 non-redeemable progression points.
          </p>
        </div>

        <a href="/admin/dashboard" className="kyc-back">
          ← Dashboard
        </a>
      </header>

      <KycManagement />

      <footer className="kyc-footer">
        SportyFanz Internal Administration · Authorised staff only
      </footer>

      <style>{`
        .kyc-page {
          min-height: 100vh;
          padding: 42px;
          box-sizing: border-box;
          background: #10121b;
          color: #f7f8fc;
          font-family: Lato, Arial, sans-serif;
        }
        .kyc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 32px;
        }
        .kyc-eyebrow {
          color: #f5b82e;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.7px;
        }
        .kyc-header h1 {
          margin: 10px 0;
          font-size: clamp(28px, 4vw, 36px);
        }
        .kyc-description {
          max-width: 720px;
          color: #a3a9bd;
          line-height: 1.7;
        }
        .kyc-back {
          color: #f5b82e;
          text-decoration: none;
          border: 1px solid #3a3e4e;
          border-radius: 9px;
          padding: 12px 16px;
          white-space: nowrap;
        }
        .kyc-back:hover { background: #282c3c; }
        .kyc-footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #292d3d;
          color: #8e95aa;
          font-size: 12px;
        }
        @media (max-width: 640px) {
          .kyc-page { padding: 24px 16px; }
          .kyc-header { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}