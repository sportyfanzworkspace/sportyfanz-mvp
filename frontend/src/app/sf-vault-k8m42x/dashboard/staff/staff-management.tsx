"use client";

import { apiFetch } from "@/lib/api";


import { useEffect, useState, type FormEvent } from "react";

type StaffRole =
  | "SUPER_ADMIN"
  | "OPERATIONS"
  | "CONTENT_MODERATION"
  | "SUPPORT";




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
  const [createdStaff, setCreatedStaff] =
    useState<StaffAccount | null>(null);
  const [selectedStaff, setSelectedStaff] =
    useState<StaffAccount | null>(null);
  const [generatedAccess, setGeneratedAccess] = useState<{
    staffId: number;
    actionUrl: string;
    expiresAt: string;
    purpose: "INVITATION" | "PASSWORD_RESET";
  } | null>(null);
  const [generatingAccess, setGeneratingAccess] = useState(false);
  const [generateAccessError, setGenerateAccessError] = useState("");
  const [copyAccessMessage, setCopyAccessMessage] = useState("");

 const [staffList, setStaffList] = useState<StaffAccount[]>([]);
 const [loadingStaff, setLoadingStaff] = useState(true);
 const [staffError, setStaffError] = useState("");
 const [updatingStaffId, setUpdatingStaffId] = useState<number | null>(null);
 const [staffRole, setStaffRole] = useState<StaffRole>("SUPPORT");
 const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);
 const [sendingAccessEmailId, setSendingAccessEmailId] =
   useState<number | null>(null);
 const [accessEmailMessage, setAccessEmailMessage] = useState("");
 const [accessEmailError, setAccessEmailError] = useState("");



  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setCreatedStaff(null);

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
      const response = await apiFetch("/api/admin/staff", {
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
      setSuccess(
        data.message ||
          (data.invitationEmailSent
            ? "Staff account created. An invitation email has been sent."
            : "Staff account created, but the invitation email was not sent.")
      );
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


async function loadStaff() {
  setLoadingStaff(true);
  setStaffError("");

  try {
    const response = await apiFetch("/api/admin/staff", {
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
      const response = await apiFetch("/api/admin/staff", {
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
    const response = await apiFetch(`/api/admin/staff/${staffId}`, {
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

async function sendStaffAccessEmail(
  staff: StaffAccount
) {
  if (staff.status !== "ACTIVE") return;

  const action = staff.mustChangePassword
    ? "resend-invitation"
    : "reset-password";

  const confirmed = window.confirm(
    staff.mustChangePassword
      ? `Send a new invitation to ${staff.email}? The previous invitation link will stop working.`
      : `Send a password reset link to ${staff.email}?`
  );

  if (!confirmed) return;

  setSendingAccessEmailId(staff.id);
  setAccessEmailMessage("");
  setAccessEmailError("");

  try {
    const response = await apiFetch(
      `/api/admin/staff/${staff.id}/${action}`,
      { method: "POST" }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to send the staff access email."
      );
    }

    setAccessEmailMessage(
      data.message || "Staff access email sent successfully."
    );
  } catch (error) {
    setAccessEmailError(
      error instanceof Error
        ? error.message
        : "Unable to send the staff access email."
    );
  } finally {
    setSendingAccessEmailId(null);
  }
}


function closeStaffDetails() {
  if (generatingAccess) return;
  setSelectedStaff(null);
  setGeneratedAccess(null);
  setGenerateAccessError("");
  setCopyAccessMessage("");
}

function openStaffDetails(staff: StaffAccount) {
  setGeneratedAccess(null);
  setGenerateAccessError("");
  setCopyAccessMessage("");
  setSelectedStaff(staff);
}

async function generateStaffAccessLink(staff: StaffAccount) {
  if (generatingAccess || staff.status !== "ACTIVE") return;

  const actionName = staff.mustChangePassword
    ? "password setup invitation"
    : "password reset";

  const confirmed = window.confirm(
    `Generate a new ${actionName} link for ${staff.name}? ` +
    "Any previously issued unused invitation or reset link " +
    "will stop working. The new link expires after one hour."
  );

  if (!confirmed) return;

  setGeneratingAccess(true);
  setGeneratedAccess(null);
  setGenerateAccessError("");
  setCopyAccessMessage("");

  try {
    const response = await apiFetch(
      `/api/admin/staff/${staff.id}/generate-access-link`,
      {
        method: "POST",
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to generate the staff access link."
      );
    }

    if (
      typeof data.actionUrl !== "string" ||
      typeof data.expiresAt !== "string" ||
      !["INVITATION", "PASSWORD_RESET"].includes(data.purpose)
    ) {
      throw new Error("Invalid response from the staff access service.");
    }

    setGeneratedAccess({
      staffId: staff.id,
      actionUrl: data.actionUrl,
      expiresAt: data.expiresAt,
      purpose: data.purpose,
    });
  } catch (error) {
    setGenerateAccessError(
      error instanceof Error
        ? error.message
        : "Unable to generate the staff access link."
    );
  } finally {
    setGeneratingAccess(false);
  }
}

async function copyStaffAccessLink() {
  if (!generatedAccess) return;

  try {
    await navigator.clipboard.writeText(generatedAccess.actionUrl);
    setCopyAccessMessage("Link copied. Share it privately.");
  } catch {
    setCopyAccessMessage(
      "Unable to copy automatically. Select and copy the link below."
    );
  }
}

async function updateStaffStatus(
  staffId: number,
  status: "ACTIVE" | "SUSPENDED"
) {
  setUpdatingStaffId(staffId);
  setStaffError("");

  try {
    const response = await apiFetch(`/api/admin/staff/${staffId}`, {
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
              A unique staff username will be generated.
              The staff member will receive a secure email invitation
              to set their password. The invitation expires after one hour.
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

      {createdStaff && (
        <section className="staff-panel staff-credentials-panel">
          <div className="staff-panel-heading">
            <div>
              <span className="staff-icon">✓</span>
              <h2>Staff account created</h2>
              <p>
                Password setup is handled through a secure email invitation.
              </p>
            </div>
            <span className="staff-access-badge">CREATED</span>
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
              <strong>{createdStaff.username}</strong>
            </div>
          </div>

          <div className="staff-form-note">
            <strong>Next step</strong>
            <p>
              The staff member should check their work email for a
              password setup invitation. If delivery fails, use
              Resend Invitation from the staff directory.
            </p>
          </div>

          <a
            className="staff-login-link"
            href="/sf-vault-k8m42x/login/"
          >
            Open private staff login
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

  {accessEmailMessage && (
    <p role="status" className="staff-alert staff-alert-success">
      {accessEmailMessage}
    </p>
  )}

  {accessEmailError && (
    <p role="alert" className="staff-alert staff-alert-error">
      {accessEmailError}
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
                <button
                  type="button"
                  onClick={() => openStaffDetails(staff)}
                  style={{ marginRight: 8 }}
                >
                  View Details
                </button>

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

                {staff.status === "ACTIVE" && (
                  <button
                    type="button"
                    disabled={
                      sendingAccessEmailId !== null ||
                      updatingStaffId === staff.id ||
                      updatingRoleId === staff.id
                    }
                    onClick={() => void sendStaffAccessEmail(staff)}
                    style={{ marginLeft: 8 }}
                  >
                    {sendingAccessEmailId === staff.id
                      ? "Sending..."
                      : staff.mustChangePassword
                        ? "Resend Invitation"
                        : "Reset Password"}
                  </button>
                )}

                {staff.mustChangePassword && (
                  <small> Password setup pending</small>
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

      {selectedStaff && (
        <div
          className="staff-details-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeStaffDetails();
            }
          }}
        >
          <section
            className="staff-details-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-details-title"
          >
            <div className="staff-details-header">
              <div>
                <h2 id="staff-details-title">
                  Staff Account Details
                </h2>
                <p>SportyFanz Internal Administration</p>
              </div>

              <button
                type="button"
                onClick={closeStaffDetails}
                disabled={generatingAccess}
                aria-label="Close staff details"
              >
                Close
              </button>
            </div>

            <dl className="staff-details-grid">
              <div>
                <dt>Staff member</dt>
                <dd>{selectedStaff.name}</dd>
              </div>

              <div>
                <dt>Work email</dt>
                <dd>{selectedStaff.email}</dd>
              </div>

              <div>
                <dt>Username</dt>
                <dd>{selectedStaff.username}</dd>
              </div>

              <div>
                <dt>Staff role</dt>
                <dd>
                  {selectedStaff.staffRole.replaceAll("_", " ")}
                </dd>
              </div>

              <div>
                <dt>Account status</dt>
                <dd>{selectedStaff.status}</dd>
              </div>

              <div>
                <dt>Password setup</dt>
                <dd>
                  {selectedStaff.mustChangePassword
                    ? "Pending"
                    : "Configured"}
                </dd>
              </div>

              <div>
                <dt>Account created</dt>
                <dd>
                  {new Date(selectedStaff.createdAt).toLocaleString()}
                </dd>
              </div>

              <div>
                <dt>Last login</dt>
                <dd>
                  {selectedStaff.lastLoginAt
                    ? new Date(selectedStaff.lastLoginAt).toLocaleString()
                    : "Never"}
                </dd>
              </div>
            </dl>

            <div className="staff-details-security">
              <strong>Staff access invitation</strong>
              <p>
                Staff passwords cannot be viewed. You can generate a new
                single-use password setup or reset link and share it
                privately with the staff member. The link expires
                after one hour.
              </p>

              {selectedStaff.status === "ACTIVE" ? (
                <>
                  <button
                    type="button"
                    className="staff-generate-link"
                    disabled={generatingAccess}
                    onClick={() =>
                      void generateStaffAccessLink(selectedStaff)
                    }
                  >
                    {generatingAccess
                      ? "Generating..."
                      : selectedStaff.mustChangePassword
                        ? "Generate Invitation Link"
                        : "Generate Password Reset Link"}
                  </button>

                  {generateAccessError && (
                    <p role="alert" className="staff-access-error">
                      {generateAccessError}
                    </p>
                  )}

                  {generatedAccess &&
                    generatedAccess.staffId === selectedStaff.id && (
                    <div className="staff-generated-link">
                      <strong>
                        {generatedAccess.purpose === "INVITATION"
                          ? "New invitation link"
                          : "New password reset link"}
                      </strong>

                      <label htmlFor="staff-access-link">
                        Secure access link
                      </label>
                      <textarea
                        id="staff-access-link"
                        value={generatedAccess.actionUrl}
                        readOnly
                        rows={3}
                        onFocus={(event) => event.currentTarget.select()}
                      />

                      <p>
                        Expires:{" "}
                        {new Date(
                          generatedAccess.expiresAt
                        ).toLocaleString()}
                      </p>

                      <button
                        type="button"
                        onClick={() => void copyStaffAccessLink()}
                      >
                        Copy Link
                      </button>

                      {copyAccessMessage && (
                        <p role="status">{copyAccessMessage}</p>
                      )}

                      <p>
                        This link will not be saved in View Details.
                        Closing this window clears it from the screen.
                        Do not share it in public chats.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p>
                  Access links can only be generated for active
                  staff accounts.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      <style>{`
        .staff-details-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.75);
        }

        .staff-details-dialog {
          width: min(100%, 620px);
          max-height: 90vh;
          overflow-y: auto;
          padding: 26px;
          border: 1px solid #45404a;
          border-radius: 16px;
          background: #171a26;
          color: #f7f8fc;
          box-sizing: border-box;
        }

        .staff-details-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 24px;
        }

        .staff-details-header h2 {
          margin: 0 0 7px;
          font-size: 22px;
        }

        .staff-details-header p {
          margin: 0;
          color: #a3a9bd;
          font-size: 12px;
        }

        .staff-details-header button {
          padding: 9px 14px;
          border: 1px solid #b88b2e;
          border-radius: 8px;
          background: transparent;
          color: #f3c969;
          cursor: pointer;
        }

        .staff-details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin: 0;
        }

        .staff-details-grid > div {
          min-width: 0;
          padding: 14px;
          border: 1px solid #343849;
          border-radius: 9px;
          background: #10121b;
        }

        .staff-details-grid dt {
          margin-bottom: 8px;
          color: #a3a9bd;
          font-size: 12px;
        }

        .staff-details-grid dd {
          margin: 0;
          overflow-wrap: anywhere;
          font-size: 14px;
          font-weight: 700;
        }

        .staff-details-security {
          margin-top: 20px;
          padding: 15px;
          border: 1px solid #554627;
          border-radius: 9px;
          background: #211f1b;
        }

        .staff-details-security strong {
          color: #f5c85e;
          font-size: 13px;
        }

        .staff-details-security p {
          margin: 8px 0 0;
          color: #c3c5cf;
          font-size: 12px;
          line-height: 1.7;
        }

        .staff-generate-link,
        .staff-generated-link button {
          margin-top: 14px;
          padding: 10px 14px;
          border: 0;
          border-radius: 8px;
          background: #f6bd35;
          color: #171a26;
          font-weight: 700;
          cursor: pointer;
        }

        .staff-generate-link:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .staff-generated-link {
          margin-top: 16px;
          padding: 14px;
          border: 1px solid #45404a;
          border-radius: 9px;
          background: #10121b;
        }

        .staff-generated-link label {
          display: block;
          margin-top: 12px;
          color: #c3c5cf;
          font-size: 12px;
        }

        .staff-generated-link textarea {
          display: block;
          width: 100%;
          margin-top: 7px;
          padding: 10px;
          box-sizing: border-box;
          border: 1px solid #45404a;
          border-radius: 7px;
          background: #171a26;
          color: #f7f8fc;
          font-size: 12px;
          overflow-wrap: anywhere;
          resize: vertical;
        }

        .staff-access-error {
          color: #ff9c9c !important;
        }

        @media (max-width: 480px) {
          .staff-details-dialog { padding: 18px; }
          .staff-details-grid { grid-template-columns: 1fr; }
        }

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
