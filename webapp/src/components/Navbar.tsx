import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Navbar({ title }: { title: string }) {
  const { userProfile, logout } = useAuth();
  const location = useLocation();
  const isManager = userProfile?.role === "manager";

  const navLinkClass = (path: string) =>
    `nav-link${location.pathname === path ? " active" : ""}`;

  return (
    <header className="navbar">
      {/* Brand */}
      <div className="navbar-brand">
        <img src="/logo.png" alt="Bright" />
        <span className="navbar-brand-title">{title}</span>
      </div>

      {/* Nav links */}
      <nav className="navbar-nav">
        <Link to="/schedule" className={navLinkClass("/schedule")}>班表</Link>
        {isManager && (
          <Link to="/admin" className={navLinkClass("/admin")}>管理後台</Link>
        )}
        {isManager && (
          <Link to="/templates" className={navLinkClass("/templates")}>班表模板</Link>
        )}
        <Link to="/unavailability" className={navLinkClass("/unavailability")}>請假申請</Link>
      </nav>

      {/* User info + logout */}
      <div className="navbar-user">
        {userProfile && (
          <div className="navbar-user-info">
            <span className="badge badge-secondary">
              {isManager ? "管理員" : "員工"}
            </span>
            <span className="navbar-user-name">{userProfile.displayName}</span>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={logout}>
          登出
        </button>
      </div>
    </header>
  );
}

