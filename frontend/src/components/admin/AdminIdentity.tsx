"use client";

type AdminIdentityProps = {
  name: string | null;
  email: string;
};

export default function AdminIdentity({
  name,
  email,
}: AdminIdentityProps) {
  const displayName = name?.trim() || "Staff Admin";

  const initial = (
    name?.trim() || email || "S"
  ).charAt(0).toUpperCase();

  return (
    <div
      className="admin-account"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minWidth: 0,
      }}
    >
      <span
        className="admin-avatar"
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          width: 42,
          height: 42,
          flexShrink: 0,
          borderRadius: "50%",
          background: "#f5b82e",
          color: "#10121b",
          fontWeight: 800,
        }}
      >
        {initial}
      </span>

      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          minWidth: 0,
        }}
      >
        <strong
          style={{
            color: "#f5f6fa",
            fontSize: 14,
            overflowWrap: "anywhere",
          }}
        >
          {displayName}
        </strong>

        <small
          style={{
            color: "#a5acc1",
            fontSize: 12,
            overflowWrap: "anywhere",
          }}
        >
          {email}
        </small>
      </span>
    </div>
  );
}
