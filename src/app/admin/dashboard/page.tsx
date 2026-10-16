import { redirect } from "next/navigation";
import {
  requireAdmin,
  hasPermission,
  type AdminPermission,
} from "@/lib/admin/require-admin";


const sections: {
  title: string;
  description: string;
  status: string;
  icon: string;
  href: string;
  permission: AdminPermission;
}[] = [
  {
    title: "Trivia Management",
    description: "Create questions, manage answer options, set points, and publish trivia.",
    status: "Ready to connect",
    icon: "?",
    href: "/admin/dashboard/trivia",
    permission: "trivia:manage",
  },
  {
    title: "Rewards Management",
    description: "Manage reward availability, inventory, and redemption requests.",
    status: "Existing rewards API",
    icon: "★",
    href: "/admin/dashboard/rewards",
    permission: "rewards:manage",
  },
  {
    title: "Polls Management",
    description: "Create polls, manage options, and monitor fan participation.",
    status: "Existing polls API",
    icon: "◉",
    href: "/admin/dashboard/polls",
    permission: "polls:manage",
  },
  {
    title: "Predictions",
    description: "Manage prediction activities and review fan submissions.",
    status: "Existing predictions API",
    icon: "↗",
    href: "/admin/dashboard/predictions",
    permission: "predictions:manage",
  },
  {
    title: "Fan Management",
    description: "View fan accounts and account status.",
    status: "Planned",
    icon: "♙",
    href: "/admin/dashboard/fans",
    permission: "fans:support",
  },
  {
    title: "Staff Management",
    description:
      "Create staff accounts, view staff details, and manage authorised access.",
    status: "Staff administration",
    icon: "♙",
    href: "/admin/dashboard/staff",
    permission: "staff:manage",
  },
];


export default async function AdminDashboardPage() {
  
const result = await requireAdmin();

   if (!result.authorized) {
     if (result.reason === "password_change_required") {
      redirect("/admin/change-password");
    }

    if (result.reason === "unauthenticated") {
      redirect("/admin/login");
    }

    redirect("/admin/login");
   }

const visibleSections = sections.filter((section) =>
  hasPermission(result.user.staffRole, section.permission)
);


  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">S</span>
          <span>
            <strong>SportyFanz</strong>
            <small>STAFF ADMIN</small>
          </span>
        </div>

        <p className="admin-nav-label">WORKSPACE</p>

        <nav className="admin-nav">
          <a className="admin-nav-link active" href="/admin/dashboard">
            <span>⌂</span> Overview
          </a>
          {visibleSections.map((section) => (
            <a className="admin-nav-link" href={section.href} key={section.title}>
              <span>{section.icon}</span>
              {section.title.replace(" Management", "")}
            </a>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <span className="admin-status-dot" />
          Internal staff portal
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">SPORTYFANZ OPERATIONS</p>
            <h1>Admin Dashboard</h1>
          </div>
          <div className="admin-account">
            <span className="admin-avatar">
              {(result.user.name || result.user.email)
                .charAt(0)
                .toUpperCase()}
            </span>
            <span>
              <strong>{result.user.name || "Staff Admin"}</strong>
              <small>{result.user.email}</small>
            </span>
          </div>
        </header>

        <div className="admin-content">
          <section className="admin-welcome">
            <div>
              <p className="admin-eyebrow">INTERNAL WORKSPACE</p>
              <h2>Welcome to SportyFanz Admin</h2>
              <p>
                Manage the content, rewards, and activities that power
                the fan experience from one central workspace.
              </p>
            </div>
            <div className="admin-welcome-mark" aria-hidden="true">
              SF
            </div>
          </section>

          <div className="admin-section-heading">
            <div>
              <h2>Management workspace</h2>
              <p>Choose an area to manage.</p>
            </div>
            <span className="admin-role-pill">
               {result.user.staffRole.replaceAll("_", " ")}
            </span>
          </div>

          <div className="admin-grid">
            {visibleSections.map((section) => (
              <article className="admin-card" key={section.title}>
                <div className="admin-card-icon">{section.icon}</div>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
                <span className="admin-card-status">{section.status}</span>
                <a className="admin-card-link" href={section.href}>
                  Open section <span aria-hidden="true">→</span>
                </a>
              </article>
            ))}
          </div>

          <footer className="admin-footer">
            SportyFanz Internal Administration · Authorised staff only
          </footer>
        </div>
      </section>

      <style>{`
        .admin-shell {
          min-height: 100vh;
          display: flex;
          background: #10121b;
          color: #f7f8fc;
          font-family: Lato, Arial, sans-serif;
        }
        .admin-sidebar {
          width: 245px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          padding: 28px 18px;
          box-sizing: border-box;
          background: #171a26;
          border-right: 1px solid #292d3d;
        }
        .admin-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 8px 34px;
        }
        .admin-brand-mark {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #f5b82e;
          color: #10121b;
          font-size: 23px;
          font-weight: 900;
        }
        .admin-brand strong, .admin-brand small,
        .admin-account strong, .admin-account small {
          display: block;
        }
        .admin-brand strong { font-size: 16px; }
        .admin-brand small {
          margin-top: 5px;
          color: #a4abc0;
          font-size: 10px;
          letter-spacing: 1.5px;
        }
        .admin-nav-label, .admin-eyebrow {
          color: #a3a9bd;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.7px;
        }
        .admin-nav-label { padding: 0 10px; margin-bottom: 12px; }
        .admin-nav { display: grid; gap: 7px; }
        .admin-nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 10px;
          border-radius: 9px;
          color: #c0c5d5;
          text-decoration: none;
          font-size: 13px;
        }
        .admin-nav-link span {
          width: 20px;
          text-align: center;
          color: #f5b82e;
        }
        .admin-nav-link:hover, .admin-nav-link.active {
          background: #282c3c;
          color: #fff;
        }
        .admin-sidebar-footer {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: auto;
          padding: 20px 8px 0;
          color: #a3a9bd;
          font-size: 11px;
        }
        .admin-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #45cf91;
        }
        .admin-main { flex: 1; min-width: 0; }
        .admin-topbar {
          min-height: 95px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 22px 36px;
          border-bottom: 1px solid #292d3d;
          box-sizing: border-box;
        }
        .admin-eyebrow { margin: 0 0 8px; }
        .admin-topbar h1 { margin: 0; font-size: 24px; }
        .admin-account { display: flex; align-items: center; gap: 11px; }
        .admin-avatar {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #34394d;
          color: #f5b82e;
          font-weight: 800;
        }
        .admin-account strong { font-size: 13px; }
        .admin-account small {
          margin-top: 4px;
          color: #a3a9bd;
          font-size: 11px;
        }
        .admin-content { max-width: 1500px; margin: auto; padding: 32px 36px; }
        .admin-welcome {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 30px;
          border: 1px solid #393548;
          border-radius: 16px;
          background: linear-gradient(120deg, #282438, #1c2030);
        }
        .admin-welcome h2 { margin: 0 0 12px; font-size: 25px; }
        .admin-welcome p:last-child {
          max-width: 610px;
          margin: 0;
          color: #c0c5d5;
          font-size: 14px;
          line-height: 1.7;
        }
        .admin-welcome-mark {
          display: grid;
          place-items: center;
          width: 76px;
          height: 76px;
          flex-shrink: 0;
          border: 1px solid #6a5830;
          border-radius: 20px;
          color: #f5b82e;
          font-size: 25px;
          font-weight: 900;
        }
        .admin-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin: 34px 0 18px;
        }
        .admin-section-heading h2 { margin: 0 0 7px; font-size: 18px; }
        .admin-section-heading p { margin: 0; color: #a3a9bd; font-size: 13px; }
        .admin-role-pill {
          padding: 8px 10px;
          border: 1px solid #5a4b2a;
          border-radius: 20px;
          color: #f5b82e;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .admin-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        .admin-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-height: 230px;
          padding: 22px;
          border: 1px solid #2e3243;
          border-radius: 14px;
          background: #191c29;
          box-sizing: border-box;
        }
        .admin-card-icon {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #2b2b36;
          color: #f5b82e;
          font-size: 21px;
          font-weight: 800;
        }
        .admin-card h3 { margin: 17px 0 9px; font-size: 16px; }
        .admin-card p {
          margin: 0 0 14px;
          color: #aeb4c7;
          font-size: 12px;
          line-height: 1.7;
        }
        .admin-card-status {
          margin-top: auto;
          color: #8e96ad;
          font-size: 10px;
        }
        .admin-card-link {
          display: flex;
          justify-content: space-between;
          width: 100%;
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid #303447;
          color: #f5b82e;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }
        .admin-card-link:hover { color: #ffda79; }
        .admin-footer {
          padding: 28px 0 4px;
          color: #777f97;
          font-size: 11px;
          text-align: center;
        }
        @media (max-width: 1050px) {
          .admin-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .admin-sidebar { width: 215px; }
          .admin-content { padding: 24px; }
          .admin-topbar { padding: 20px 24px; }
        }
        @media (max-width: 700px) {
          .admin-sidebar { display: none; }
          .admin-grid { grid-template-columns: 1fr; }
          .admin-topbar { align-items: flex-start; flex-direction: column; }
          .admin-content { padding: 18px; }
          .admin-welcome { padding: 22px; }
          .admin-welcome h2 { font-size: 21px; }
          .admin-welcome-mark { display: none; }
        }
      `}</style>
    </main>
  );
}
