"use client";

import { useEffect, useState, type ReactNode } from "react";

import { apiFetch } from "@/lib/api";
import AdminIdentity from "@/components/admin/AdminIdentity";

type StaffRole =
  | "SUPER_ADMIN"
  | "OPERATIONS"
  | "CONTENT_MODERATION"
  | "SUPPORT";

type AdminPermission =
  | "staff:read"
  | "staff:manage"
  | "rewards:manage"
  | "predictions:manage"
  | "trivia:manage"
  | "polls:manage"
  | "fanrooms:manage"
  | "content:moderate"
  | "fans:support"
  | "players:manage"
  | "kyc:manage";

const ROLE_PERMISSIONS: Record<StaffRole, AdminPermission[]> = {
  SUPER_ADMIN: [
    "staff:read",
    "staff:manage",
    "rewards:manage",
    "predictions:manage",
    "trivia:manage",
    "polls:manage",
    "fanrooms:manage",
    "content:moderate",
    "fans:support",
    "players:manage",
    "kyc:manage",
  ],
  OPERATIONS: [
    "rewards:manage",
    "predictions:manage",
    "kyc:manage",
  ],
  CONTENT_MODERATION: [
    "trivia:manage",
    "polls:manage",
    "content:moderate",
  ],
  SUPPORT: ["fans:support"],
};

export default function PrivateStaffPermissionGuard({
  permission,
  children,
}: {
  permission: AdminPermission;
  children: ReactNode;
}) {

  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminIdentity, setAdminIdentity] = useState<{
    name: string | null;
    email: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      try {
        const response = await apiFetch("/api/admin/me", {
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (!active) return;

        if (
          response.status === 403 &&
          data.code === "PASSWORD_CHANGE_REQUIRED"
        ) {
          window.location.replace("/sf-vault-k8m42x/change-password/");
          return;
        }

        if (response.status === 401) {
          window.location.replace("/sf-vault-k8m42x/login/");
          return;
        }

        if (!response.ok) {
          window.location.replace("/sf-vault-k8m42x/login/");
          return;
        }

        const role = data.admin?.staffRole as StaffRole | undefined;

        if (
          !role ||
          !ROLE_PERMISSIONS[role]?.includes(permission)
        ) {
          window.location.replace("/sf-vault-k8m42x/dashboard/");
          return;
        }

        setAdminIdentity({
          name: data.admin?.name ?? null,
          email: data.admin?.email ?? "",
        });
        setAllowed(true);
      } catch {
        if (active) {
          window.location.replace("/sf-vault-k8m42x/login/");
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    verifyAccess();

    return () => {
      active = false;
    };
  }, [permission]);

  if (checking || !allowed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#10121b",
          color: "#f5b82e",
          fontFamily: "Lato, Arial, sans-serif",
        }}
      >
        Verifying staff access...
      </main>
    );
  }

  return (
    <>
      {adminIdentity && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "16px 28px",
            background: "#10121b",
            borderBottom: "1px solid #303447",
          }}
        >
          <AdminIdentity
            name={adminIdentity.name}
            email={adminIdentity.email}
          />
        </div>
      )}
      {children}
    </>
  );
}
