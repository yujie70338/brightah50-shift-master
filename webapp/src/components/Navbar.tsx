import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Navbar({ title }: { title: string }) {
  const { userProfile, logout } = useAuth();
  const location = useLocation();
  const isManager = userProfile?.role === "manager";

  const linkStyle = (path: string): React.CSSProperties => ({
    color: location.pathname === path ? "#2563eb" : "#374151",
    fontWeight: location.pathname === path ? 600 : 400,
    textDecoration: "none",
  });

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "1.25rem" }}>{title}</h1>
      <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <Link to="/schedule" style={linkStyle("/schedule")}>
          班表
        </Link>
        {isManager && (
          <Link to="/admin" style={linkStyle("/admin")}>
            管理後台
          </Link>
        )}
        {isManager && (
          <Link to="/templates" style={linkStyle("/templates")}>
            班表模板
          </Link>
        )}
        <Link to="/unavailability" style={linkStyle("/unavailability")}>
          請假申請
        </Link>
        <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>
          {userProfile?.displayName}
        </span>
        <button
          onClick={logout}
          style={{ padding: "0.3rem 0.75rem", cursor: "pointer" }}
        >
          登出
        </button>
      </nav>
    </header>
  );
}
