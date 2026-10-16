
"use client";

import { useEffect, useState, type FormEvent } from "react";

type StaffRole =
  | "SUPER_ADMIN"
  | "OPERATIONS"
  | "CONTENT_MODERATION"
  | "SUPPORT";

type StaffCredentials = {
  username: string;
  temporaryPassword: string;
};


 type StaffAccount = {
  id: number;
  name: string;
  email: string;
  username: string;
  role: string;
  staffRole: StaffRole;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};


export default function StaffManagement() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [credentials, setCredentials] =
    useState<StaffCredentials | null>(null);
  const [createdStaff, setCreatedStaff] =
    useState<StaffAccount | null>(null);
  const [copied, setCopied] = useState(false);
  
 const [staffList, setStaffList] = useState<StaffAccount[]>([]);
 const [loadingStaff, setLoadingStaff] = useState(true);
 const [staffError, setStaffError] = useState("");
 const [updatingStaffId, setUpdatingStaffId] = useState<number | null>(null);
 const [staffRole, setStaffRole] = useState<StaffRole>("SUPPORT");
 const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setCredentials(null);
    setCreatedStaff(null);
    setCopied(false);

    if (name.trim().length < 2) {
      setError("Enter the staff member's full name.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid work email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          staffRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create staff account.");
      }

      setCreatedStaff(data.staff);
      setCredentials(data.credentials);
      setSuccess("Staff account created successfully.");
      setName("");
      setEmail("");
      setStaffRole("SUPPORT");
   await loadStaff();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  
  async function copyCredentials() {
    if (!credentials) return;

    try {
      await navigator.clipboard.writeText(
        `SportyFanz Staff Login\nUsername: ${credentials.username}\nTemporary password: ${credentials.temporaryPassword}\nLogin page: /admin/login\nPlease change the temporary password immediately after signing in.`
      );

      setCopied(true);
    } catch {
      setError(
        "Could not copy automatically. Select and copy the credentials manually."
      );
    }
  }

  
async function loadStaff() {
  setLoadingStaff(true);
  setStaffError("");

  try {
    const response = await fetch("/api/admin/staff", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load staff accounts.");
    }

    setStaffList(data.staff ?? []);
  } catch (error) {
    setStaffError(
      error instanceof Error
        ? error.message
        : "Unable to load staff accounts."
    );
  } finally {
    setLoadingStaff(false);
  }
}


useEffect(() => {
  let cancelled = false;

  async function fetchStaff() {
    setStaffError("");

    try {
      const response = await fetch("/api/admin/staff", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load staff accounts.");
      }

      if (!cancelled) {
        setStaffList(data.staff ?? []);
      }
    } catch (error) {
      if (!cancelled) {
        setStaffError(
          error instanceof Error
            ? error.message
            : "Unable to load staff accounts."
        );
      }
    } finally {
      if (!cancelled) {
        setLoadingStaff(false);
      }
    }
  }

  void fetchStaff();

  return () => {
    cancelled = true;
  };
}, []);

async function updateStaffRole(
  staffId: number,
  nextRole: StaffRole
) {
  setUpdatingRoleId(staffId);
  setStaffError("");

  try {
    const response = await fetch(`/api/admin/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffRole: nextRole }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to update staff role.");
    }

    await loadStaff();
  } catch (error) {
    setStaffError(
      error instanceof Error
        ? error.message
        : "Unable to update staff role."
    );
  } finally {
    setUpdatingRoleId(null);
  }
}

async function updateStaffStatus(
  staffId: number,
  status: "ACTIVE" | "SUSPENDED"
) {
  setUpdatingStaffId(staffId);
  setStaffError("");

  try {
    const response = await fetch(`/api/admin/staff/${staffId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to update staff status.");
    }

    await loadStaff();
  } catch (error) {
    setStaffError(
      error instanceof Error
        ? error.message
        : "Unable to update staff status."
    );
  } finally {
    setUpdatingStaffId(null);
  }
}


  return (
    <div className="staff-workspace">
      <section className="staff-panel">
        <div className="staff-panel-heading">
          <div>
            <span className="staff-icon">＋</span>
            <h2>Create a staff account</h2>
            <p>
              Only authorised administrators can create internal staff accounts.
            </p>
          </div>
          <span className="staff-access-badge">ADMIN ONLY</span>
        </div>

        <form onSubmit={handleSubmit} className="staff-form">
          <label>
            Full name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter staff member's name"
              autoComplete="name"
              maxLength={100}
              required
            />
          </label>

          <label>
            Work email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@company.com"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>

          <label>
             Staff role
            <select
               value={staffRole}
               onChange={(event) =>
              setStaffRole(event.target.value as StaffRole)
            }
            required
          >
          <option value="SUPPORT">Support</option>
          <option value="OPERATIONS">Operations</option>
          <option value="CONTENT_MODERATION">
             Content Moderation
          </option>
          <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </label>

          <div className="staff-form-note">
            <strong>Security notice</strong>
            <p>
              A unique username and temporary password will be generated.
              The staff member must change the password at first login.
            </p>
          </div>

          {error && (
            <div className="staff-alert staff-alert-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="staff-alert staff-alert-success" role="status">
              {success}
            </div>
          )}

          <button className="staff-primary-button" disabled={loading}>
            {loading ? "Creating account..." : "＋ Create staff account"}
          </button>
        </form>
      </section>

      {credentials && createdStaff && (
        <section className="staff-panel staff-credentials-panel">
          <div className="staff-panel-heading">
            <div>
              <span className="staff-icon">✓</span>
              <h2>Account created</h2>
              <p>Share these credentials securely with the staff member.</p>
            </div>
            <span className="staff-access-badge">ACTIVE</span>
          </div>

          <div className="staff-created-details">
            <div>
              <span>Staff member</span>
              <strong>{createdStaff.name}</strong>
            </div>
            <div>
              <span>Work email</span>
              <strong>{createdStaff.email}</strong>
            </div>
            <div>
              <span>Username</span>
              <strong>{credentials.username}</strong>
            </div>
            <div>
              <span>Temporary password</span>
              <strong className="staff-temp-password">
                {credentials.temporaryPassword}
              </strong>
            </div>
          </div>

          <div className="staff-form-note">
            <strong>Important</strong>
            <p>
              This temporary password is displayed only after account creation.
              Store it securely and do not send it through a public channel.
              The staff member must change it after signing in.
            </p>
          </div>

          <button
            type="button"
            className="staff-primary-button"
            onClick={copyCredentials}
          >
            {copied ? "✓ Credentials copied" : "Copy login credentials"}
          </button>

          <a className="staff-login-link" href="/admin/login">
            Open staff login →
          </a>
        </section>
      )}

      <section className="staff-panel">
        <div className="staff-panel-heading">
          <div>
            <span className="staff-icon">♙</span>
            <h2>Staff directory</h2>
            <p>
              Staff listing and account-status controls will be connected to
              the protected staff API next.
            </p>
          </div>
        </div>

            
   <section className="staff-directory">
  
    <div className="staff-directory-heading">
    <div>
      <h2>Staff Directory</h2>
      <p>Manage staff accounts and authorised access.</p>
    </div>

    <button type="button" onClick={() => void loadStaff()}>
      Refresh
    </button>
  </div>

  {staffError && (
    <p role="alert" className="staff-error">
      {staffError}
    </p>
  )}

  {loadingStaff ? (
    <p>Loading staff accounts...</p>
  ) : staffList.length === 0 ? (
    <p>No staff accounts found.</p>
  ) : (
    <div className="staff-table-wrap">
      <table className="staff-table">
        <thead>
          <tr>
            <th>Staff member</th>
            <th>Username</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last login</th>
            <th>Access</th>
          </tr>
        </thead>

        <tbody>
          {staffList.map((staff) => (
            <tr key={staff.id}>
              <td>
                <strong>{staff.name}</strong>
                <small>{staff.email}</small>
              </td>

              <td>{staff.username}</td>
                
              <td>
                <select
                  aria-label={`Role for ${staff.name}`}
                  value={staff.staffRole}
                  disabled={
                  updatingRoleId === staff.id ||
                  updatingStaffId === staff.id
                  }
                 onChange={(event) =>
                  void updateStaffRole(
                  staff.id,
                  event.target.value as StaffRole
                  )
                }
             >
             <option value="SUPER_ADMIN">Super Admin</option>
             <option value="OPERATIONS">Operations</option>
             <option value="CONTENT_MODERATION">
               Content Moderation
             </option>
             <option value="SUPPORT">Support</option>
               </select>
               {updatingRoleId === staff.id && <small>Saving role…</small>}
             </td>


              <td>
                <span
                  className={`staff-status staff-status-${staff.status.toLowerCase()}`}
                >
                  {staff.status}
                </span>
              </td>

              <td>
                {staff.lastLoginAt
                  ? new Date(staff.lastLoginAt).toLocaleString()
                  : "Never"}
              </td>

              <td>
                {staff.status !== "DELETED" && (
                  <button
                    type="button"
                    disabled={updatingStaffId === staff.id}
                    onClick={() =>
                      void updateStaffStatus(
                        staff.id,
                        staff.status === "ACTIVE"
                          ? "SUSPENDED"
                          : "ACTIVE"
                      )
                    }
                  >
                    {updatingStaffId === staff.id
                      ? "Updating..."
                      : staff.status === "ACTIVE"
                        ? "Suspend"
                        : "Activate"}
                  </button>
                )}

                {staff.mustChangePassword && (
                  <small> Password change required</small>
                )}
                </td>
               </tr>
              ))}
             </tbody>
            </table>
           </div>
          )}
         </section>
      </section>

      <style>{`
        .staff-workspace {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 22px;
          align-items: start;
        }
        .staff-panel {
          min-width: 0;
          padding: 25px;
          background: #171a26;
          border: 1px solid #292d3d;
          border-radius: 16px;
          box-sizing: border-box;
        }
        .staff-panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 24px;
        }
        .staff-panel-heading h2 {
          margin: 13px 0 8px;
          font-size: 19px;
        }
        .staff-panel-heading p {
          margin: 0;
          color: #a3a9bd;
          font-size: 13px;
          line-height: 1.6;
        }
        .staff-icon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: #302a1d;
          color: #f5b82e;
          font-size: 21px;
        }
        .staff-access-badge {
          flex-shrink: 0;
          padding: 7px 9px;
          border-radius: 7px;
          background: #302a1d;
          color: #f5b82e;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .staff-form { display: grid; gap: 19px; }
        .staff-form label {
          display: grid;
          gap: 9px;
          color: #e8eaf2;
          font-size: 13px;
          font-weight: 700;
        }
        .staff-form input {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 13px 14px;
          border: 1px solid #383d50;
          border-radius: 9px;
          outline: none;
          background: #10121b;
          color: #f7f8fc;
          font: inherit;
          font-weight: 400;
        }
        .staff-form input:focus {
          border-color: #f5b82e;
          box-shadow: 0 0 0 3px #f5b82e20;
        }
        .staff-form input::placeholder { color: #777f96; }
        .staff-form-note {
          padding: 14px;
          border: 1px solid #383328;
          border-radius: 10px;
          background: #211f1b;
        }
        .staff-form-note strong {
          color: #f5c85e;
          font-size: 12px;
        }
        .staff-form-note p {
          margin: 7px 0 0;
          color: #c3c5cf;
          font-size: 12px;
          line-height: 1.7;
        }
          .staff-form select {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            padding: 13px 14px;
            border: 1px solid #383d50;
            border-radius: 9px;
            outline: none;
            background: #10121b;
            color: #f7f8fc;
            font: inherit;
          }

          .staff-form select:focus {
             border-color: #f5b82e;
             box-shadow: 0 0 0 3px #f5b82e20;
           }
        .staff-table select {
         max-width: 190px;
         padding: 7px 9px;
         border: 1px solid #383d50;
         border-radius: 7px;
         background: #10121b;
         color: #f7f8fc;
         font-size: 12px;
       }

        .staff-table select:disabled {
           opacity: 0.6;
           cursor: wait;
         }
        .staff-alert {
          padding: 12px 14px;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.5;
        }
        .staff-alert-error {
          border: 1px solid #7c343d;
          background: #321b22;
          color: #ffb7c0;
        }
        .staff-alert-success {
          border: 1px solid #286b50;
          background: #152d25;
          color: #a5efc9;
        }
        .staff-primary-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          padding: 13px 16px;
          border: 0;
          border-radius: 9px;
          background: #f5b82e;
          color: #10121b;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }
        .staff-primary-button:hover { background: #ffd064; }
        .staff-primary-button:disabled {
          cursor: wait;
          opacity: .65;
        }
        .staff-credentials-panel { border-color: #6a5526; }
        .staff-created-details {
          display: grid;
          gap: 0;
          margin-bottom: 18px;
          border: 1px solid #333747;
          border-radius: 10px;
          overflow: hidden;
        }
        .staff-created-details > div {
          display: grid;
          gap: 6px;
          padding: 13px;
          border-bottom: 1px solid #333747;
        }
        .staff-created-details > div:last-child { border-bottom: 0; }
        .staff-created-details span {
          color: #a3a9bd;
          font-size: 11px;
        }
        .staff-created-details strong {
          overflow-wrap: anywhere;
          font-size: 13px;
        }
        .staff-temp-password {
          color: #f5c85e;
          user-select: all;
        }
        .staff-login-link {
          display: block;
          margin-top: 17px;
          color: #f5b82e;
          text-align: center;
          text-decoration: none;
          font-size: 13px;
        }
        .staff-directory-placeholder {
          display: grid;
          justify-items: center;
          padding: 34px 14px;
          border: 1px dashed #383d50;
          border-radius: 12px;
          text-align: center;
        }
        .staff-directory-placeholder > span {
          color: #f5b82e;
          font-size: 29px;
        }
        .staff-directory-placeholder strong {
          margin-top: 12px;
          font-size: 14px;
        }
        .staff-directory-placeholder p {
          max-width: 290px;
          color: #a3a9bd;
          font-size: 12px;
          line-height: 1.7;
        }
          
       .staff-directory {
         margin-top: 28px;
         padding: 24px;
         border: 1px solid #343434;
         border-radius: 16px;
         background: #171717;
         color: #f5f5f5;
        }

.staff-directory-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.staff-directory-heading h2 {
  margin: 0 0 6px;
}

.staff-directory-heading p,
.staff-table small {
  display: block;
  color: #a7a7a7;
  font-size: 13px;
  margin-top: 5px;
}

.staff-directory button {
  padding: 9px 13px;
  border: 1px solid #b88b2e;
  border-radius: 8px;
  background: transparent;
  color: #f3c969;
  cursor: pointer;
}

.staff-directory button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.staff-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.staff-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.staff-table th,
.staff-table td {
  padding: 14px 12px;
  border-bottom: 1px solid #303030;
  vertical-align: top;
  white-space: nowrap;
}

.staff-table th {
  color: #c8a34d;
  font-size: 12px;
  text-transform: uppercase;
}
.staff-role-badge {
  display: inline-block;
  padding: 5px 9px;
  border: 1px solid #5a4a28;
  border-radius: 7px;
  background: #302a1d;
  color: #f5c85e;
  font-size: 11px;
  font-weight: 700;
}
.staff-status {
  display: inline-block;
  padding: 5px 9px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
}

.staff-status-active {
  color: #9ce6b0;
  background: #173c27;
}

.staff-status-suspended {
  color: #ffcf91;
  background: #49351b;
}

.staff-status-deleted {
  color: #ffaaaa;
  background: #482323;
}

.staff-error {
  color: #ffaaaa;
  margin: 12px 0;
}

        @media (max-width: 900px) {
          .staff-workspace { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .staff-panel { padding: 18px; }
          .staff-panel-heading { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
