import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";

export function LoginPage() {
  const { firebaseUser, loading, signInWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  if (loading) return <div>載入中…</div>;
  if (firebaseUser) return <Navigate to="/schedule" replace />;

  const handleLogin = async () => {
    setError("");
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setError("帳號未授權，請確認帳密，或請洽管理員");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: "1rem",
      }}
    >
      <h1>排班系統</h1>
      <p>請使用公司 Google 帳號登入</p>
      <button
        onClick={handleLogin}
        disabled={signingIn}
        style={{ padding: "0.75rem 2rem", fontSize: "1rem", cursor: "pointer" }}
      >
        {signingIn ? "登入中…" : "使用 Google 登入"}
      </button>
      {error && (
        <div
          style={{
            padding: "0.75rem 1.25rem",
            background: "#fee2e2",
            border: "1px solid #f87171",
            borderRadius: "6px",
            color: "#b91c1c",
            fontSize: "0.95rem",
            maxWidth: "320px",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
