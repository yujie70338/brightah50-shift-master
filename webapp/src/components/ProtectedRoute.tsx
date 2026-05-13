import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  requireRole?: "manager" | "doctor" | "assistant";
}

export function ProtectedRoute({ children, requireRole }: Props) {
  const { firebaseUser, userProfile, loading } = useAuth();

  if (loading) return <div>載入中…</div>;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (requireRole && userProfile?.role !== requireRole) {
    return <Navigate to="/schedule" replace />;
  }

  return <>{children}</>;
}
