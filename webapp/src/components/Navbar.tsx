import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Navbar({ title }: { title: string }) {
  const { userProfile, logout } = useAuth();
  const location = useLocation();
  const isManager = userProfile?.role === "manager";

  const navLinkStyle = (path: string): React.CSSProperties => ({
    color: location.pathname === path ? "var(--color-primary-dark)" : "var(--color-gray-600)",
    fontWeight: location.pathname === path ? 700 : 500,
    textDecoration: "none",
    fontSize: "var(--font-size-base)",
    padding: "4px 2px",
    borderBottom: location.pathname === path
      ? "2px solid var(--color-primary)"
      : "2px solid transparent",
    transition: "color 0.15s, border-color 0.15s",
  });

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 var(--space-4)",
        height: "56px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
        <img src="/logo.png" alt="Bright" style={{ height: "32px", width: "auto" }} />
        <span
          style={{
            fontWeight: 700,
            fontSize: "var(--font-size-base)",
            color: "var(--color-gray-700)",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
      </div>

      {/* Nav links */}
      <nav style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
        <Link to="/schedule" style={navLinkStyle("/schedule")}>班表</Link>
        {isManager && (
          <Link to="/admin" style={navLinkStyle("/admin")}>管理後台</Link>
        )}
        {isManager && (
          <Link to="/templates" style={navLinkStyle("/templates")}>班表模板</Link>
        )}
        <Link to="/unavailability" style={navLinkStyle("/unavailability")}>請假申請</Link>
      </nav>

      {/* User info + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        {userProfile && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span
              className="badge badge-secondary"
              style={{ fontSize: "var(--font-size-xs)" }}
            >
              {isManager ? "管理員" : "員工"}
            </span>
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-gray-700)" }}>
              {userProfile.displayName}
            </span>
          </div>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={logout}
          style={{ padding: "0.3rem 0.7rem" }}
        >
          登出
        </button>
      </div>
    </header>
  );
}

