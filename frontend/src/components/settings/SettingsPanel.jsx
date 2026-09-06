import { useState, useEffect } from "react";
import { SETTINGS_SECTIONS, ACCENT_COLORS } from "../../data/settingsData";
import Avatar from "../../utils/Avatar";
import "./SettingsPanel.css";

const hexToRgba = (hex, alpha) => {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

// ─── PRIMITIVE COMPONENTS ──────────────────────────────────────────────────────

function SettingsHeader({ title, subtitle, accent = "#7C3AED" }) {
  return (
    <div className="settings-header">
      <div className="settings-header__title">{title}</div>
      <div
        className="settings-header__subtitle"
        style={{
          "--settings-subtitle-color":
            accent === "#EF4444"
              ? "rgba(248,113,113,0.65)"
              : "rgba(255,255,255,0.3)",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function SettingsRow({ label, hint, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">{label}</div>
      {children}
      {hint && <div className="settings-row__hint">{hint}</div>}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <div
      className={`settings-toggle${value ? " settings-toggle--on" : ""}`}
      onClick={() => onChange(!value)}
    >
      <div className="settings-toggle__thumb" />
    </div>
  );
}

function SettingsSave({ onSave, saved }) {
  return (
    <div className="settings-save">
      <button className="settings-save__button" onClick={onSave}>
        Save Changes
      </button>
      {saved && <div className="settings-save__status">Saved</div>}
    </div>
  );
}

// ─── AVATAR DROPDOWN ─────────────────────────────────────────────────────────

export function AvatarDropdown({ user, onSettings, onLogout, onClose }) {
  const items = [
    { icon: "⚙", label: "Settings", action: onSettings },
    { icon: "?", label: "Help & Docs", action: onClose },
  ];
  return (
    <div className="avatar-dropdown">
      <style>{`@keyframes dropIn{from{opacity:0;transform:translateY(-8px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div className="dropdown-container">
        {/* User row */}
        <div className="dropdown-user-section">
          <div className="dropdown-user-info">
            <div className="dropdown-user-avatar"><Avatar user={user}/></div>
            <div className="dropdown-user-details">
              <div className="dropdown-user-name">{user?.name || "User"}</div>
              <div className="dropdown-user-email">{user?.email || ""}</div>
            </div>
          </div>
          {/* Storage bar inside dropdown */}
          <div className="dropdown-storage-section">
            <div className="dropdown-storage-header">
              <div className="dropdown-storage-label">STORAGE</div>
              <div className="dropdown-storage-value">1.4 GB / 5 GB</div>
            </div>
            <div className="dropdown-storage-bar-container">
              <div className="dropdown-storage-bar-fill" />
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="dropdown-menu">
          {items.map(({ icon, label, action }) => (
            <div
              key={label}
              onClick={action}
              className="dropdown-menu-item"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "rgba(255,255,255,0.6)";
              }}
            >
              <span className="dropdown-menu-icon">{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Logout */}
        <div className="dropdown-logout-section">
          <div
            onClick={onLogout}
            className="dropdown-logout-item"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              e.currentTarget.style.color = "#EF4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(239,68,68,0.6)";
            }}
          >
            <span className="dropdown-logout-icon">↩</span>
            <span>Sign Out</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPanel({
  user,
  accent,
  aiEnabled,
  onAiEnabledChange,
  onAccentSave,
  onClose,
  onLogout,
}) {
  const [activeSection, setActiveSection] = useState("Account");
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [draftAccent, setDraftAccent] = useState(accent);
  const [notifyExpiry, setNotifyExpiry] = useState(true);
  const [saved, setSaved] = useState(false);

  const saveFlash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  useEffect(() => {
    setDraftAccent(accent);
  }, [accent]);

  const handleAppearanceSave = () => {
    onAccentSave(draftAccent);
    saveFlash();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(2,4,10,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 680,
          height: 520,
          display: "flex",
          background: "linear-gradient(160deg,#0C0F1C,#080A16)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 40px 120px rgba(0,0,0,0.85)",
          animation: "scaleIn 0.25s cubic-bezier(.34,1.2,.64,1)",
        }}
      >
        {/* Left nav */}
        <div
          style={{
            width: 180,
            flexShrink: 0,
            padding: "24px 12px",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: "rgba(255,255,255,0.18)",
              letterSpacing: "0.14em",
              padding: "0 8px",
              marginBottom: 10,
            }}
          >
            SETTINGS
          </div>
          {SETTINGS_SECTIONS.map((s) => {
            const active = activeSection === s;
            const isDanger = s === "Danger Zone";
            return (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  fontFamily: "inherit",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  transition: "all 0.15s",
                  border: `1px solid ${active ? (isDanger ? "rgba(239,68,68,0.3)" : "rgba(124,58,237,0.3)") : "transparent"}`,
                  background: active
                    ? isDanger
                      ? "rgba(239,68,68,0.1)"
                      : "rgba(124,58,237,0.12)"
                    : "transparent",
                  color: active
                    ? isDanger
                      ? "#F87171"
                      : "#C4B5FD"
                    : isDanger
                      ? "rgba(239,68,68,0.45)"
                      : "rgba(255,255,255,0.38)",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.color = isDanger
                      ? "rgba(239,68,68,0.7)"
                      : "rgba(255,255,255,0.7)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = isDanger
                      ? "rgba(239,68,68,0.45)"
                      : "rgba(255,255,255,0.38)";
                  }
                }}
              >
                {s}
              </button>
            );
          })}
          <div style={{ marginTop: "auto" }}>
            <button
              onClick={onClose}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11,
                letterSpacing: "0.06em",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.3)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "white";
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.3)";
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Right content */}
        <div
          style={{
            flex: 1,
            padding: "28px 28px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {/* ── ACCOUNT ── */}
          {activeSection === "Account" && (
            <>
              <SettingsHeader
                title="Account"
                subtitle="Manage your profile and credentials"
              />
              {/* Need to add logic to update display name and have display name in the DB */}
              <SettingsRow
                label="Display Name"
                hint="How your name appears across the vault"
              >
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 12,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
              </SettingsRow>
              <SettingsRow label="Email" hint="Cannot be changed in this demo">
                <input
                  value={user?.email || ""}
                  readOnly
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 12,
                    fontFamily: "inherit",
                    outline: "none",
                    cursor: "not-allowed",
                  }}
                />
              </SettingsRow>
              <SettingsRow
                label="Avatar"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg,${draftAccent},${hexToRgba(draftAccent, 0.72)})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    <Avatar user={user}/>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.25)",
                      fontStyle: "italic",
                    }}
                  >
                  </div>
                </div>
              </SettingsRow>
              <SettingsSave onSave={saveFlash} saved={saved} />
            </>
          )}

          {/* ── APPEARANCE ── */}
          {activeSection === "Appearance" && (
            <>
              <SettingsHeader
                title="Appearance"
                subtitle="Customise how the vault looks"
              />
              <SettingsRow
                label="Accent Colour"
                hint="Sets the highlight colour across the interface"
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ACCENT_COLORS.map((a) => (
                    <div
                      key={a.name}
                      onClick={() => setDraftAccent(a.color)}
                      title={a.name}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: a.color,
                        cursor: "pointer",
                        border: `2px solid ${draftAccent === a.color ? "white" : "transparent"}`,
                        boxShadow:
                          draftAccent === a.color
                            ? `0 0 12px ${a.color}88`
                            : "none",
                        transition: "all 0.2s",
                        transform:
                          draftAccent === a.color ? "scale(1.18)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </SettingsRow>
              <SettingsRow
                label="Default View"
                hint="Which mode opens when you log in"
              >
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    ["grid", "✦ Space"],
                    ["timeline", "⋮ Timeline"],
                  ].map(([v, l]) => (
                    <div
                      key={v}
                      style={{
                        padding: "7px 16px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 11,
                        fontFamily: "inherit",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.5)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
              </SettingsRow>
              <SettingsSave onSave={handleAppearanceSave} saved={saved} />
            </>
          )}

          {/* ── STORAGE ── */}
          {activeSection === "Storage" && (
            <>
              <SettingsHeader
                title="Storage"
                subtitle="Monitor and manage your vault capacity"
              />
              <div
                style={{
                  padding: "18px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    Used
                  </div>
                  <div
                    style={{ fontSize: 12, color: "white", fontWeight: 600 }}
                  >
                    1.4 GB{" "}
                    <span
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        fontWeight: 400,
                      }}
                    >
                      / 5 GB
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "rgba(255,255,255,0.07)",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: "28%",
                      background: "linear-gradient(90deg,#7C3AED,#14B8A6)",
                      borderRadius: 3,
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  {[
                    ["Photos", "340 MB"],
                    ["Videos", "920 MB"],
                    ["Docs", "82 MB"],
                    ["Other", "58 MB"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div
                        style={{
                          fontSize: 9,
                          color: "rgba(255,255,255,0.25)",
                          letterSpacing: "0.1em",
                          marginBottom: 3,
                        }}
                      >
                        {k.toUpperCase()}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}
                      >
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: "auto" }}>
                <button
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    background:
                      "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(79,70,229,0.3))",
                    border: "1px solid rgba(124,58,237,0.4)",
                    color: "#C4B5FD",
                  }}
                >
                  ↑ Upgrade to 50 GB
                </button>
              </div>
            </>
          )}

          {/* ── AI & TAGGING ── */}
          {activeSection === "AI & Categories" && (
            <>
              <SettingsHeader
                title="AI & Categories"
                subtitle="Control AI-powered analysis across the vault"
              />
              <SettingsRow
                label="Enable AI"
                hint="Turn AI features on or off for the current browser. When disabled, tags, summaries, and AI search tools are hidden."
              >
                <Toggle value={aiEnabled} onChange={onAiEnabledChange} />
              </SettingsRow>
              <SettingsRow
                label="Current AI Features"
                hint={aiEnabled
                  ? "Image tagging and document summaries are available. File categories are still assigned from the file extension."
                  : "AI features are currently disabled. File categories continue to use the normal extension-based rules."
                }
              >
                <div
                  style={{
                    padding: "12px 14px",
                    background: aiEnabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)",
                    border: aiEnabled ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 10,
                    color: aiEnabled ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.52)",
                    fontSize: 11,
                    lineHeight: 1.7,
                  }}
                >
                  {aiEnabled
                    ? "Image files can be analyzed to generate tags automatically."
                    : "Image tagging is hidden while AI is disabled."}
                  <br />
                  {aiEnabled
                    ? "Supported documents can generate AI summaries on request."
                    : "Document summaries are unavailable while AI is disabled."}
                  <br />
                  Category detection is rule-based, not AI-driven.
                </div>
              </SettingsRow>
              <SettingsSave onSave={saveFlash} saved={saved} />
            </>
          )}

          {/* ── DANGER ZONE ── */}
          {activeSection === "Danger Zone" && (
            <>
              <SettingsHeader
                title="Danger Zone"
                subtitle="Irreversible actions — proceed carefully"
                accent="#EF4444"
              />
              {[
                {
                  label: "Reset categories",
                  hint: "Removes stored category choices from your files. Files remain untouched.",
                  btn: "Reset Categories",
                  color: "#F59E0B",
                },
                {
                  label: "Delete all files",
                  hint: "Permanently deletes every file in your vault. This cannot be undone.",
                  btn: "Delete All",
                  color: "#EF4444",
                },
              ].map(({ label, hint, btn, color }) => (
                <div
                  key={label}
                  style={{
                    padding: "16px",
                    background: `rgba(239,68,68,0.04)`,
                    border: `1px solid rgba(239,68,68,0.1)`,
                    borderRadius: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 20,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.7)",
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.25)",
                        lineHeight: 1.6,
                        fontStyle: "italic",
                      }}
                    >
                      {hint}
                    </div>
                  </div>
                  <button
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      background: `${color}18`,
                      border: `1px solid ${color}44`,
                      color,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${color}28`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `${color}18`;
                    }}
                  >
                    {btn}
                  </button>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={onLogout}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#F87171",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                  }}
                >
                  ↩ Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
