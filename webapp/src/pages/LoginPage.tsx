import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";

export function LoginPage() {
  const { firebaseUser, loading, signInWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  if (loading) {
    return (
      <div className="loading-center" style={{ height: "100vh" }}>
        <div className="spinner" />
        <span>載入中…</span>
      </div>
    );
  }
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
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, var(--color-primary-subtle) 0%, var(--color-secondary-light) 100%)",
        padding: "var(--space-4)",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          padding: "var(--space-10) var(--space-8)",
          boxShadow: "var(--shadow-xl)",
          borderRadius: "var(--radius-xl)",
        }}
      >
        <img
          src="/logo.png"
          alt="萊特動物醫院"
          style={{ width: "120px", height: "auto", marginBottom: "var(--space-2)" }}
        />
        <div style={{ textAlign: "center", lineHeight: 1.4 }}>
          <h1
            style={{
              margin: "0 0 var(--space-1) 0",
              fontSize: "var(--font-size-xl)",
              fontWeight: 700,
              color: "var(--color-gray-800)",
              letterSpacing: "0.02em",
            }}
          >
            萊特動物醫院
          </h1>
          <p
            style={{
              margin: "0 0 2px 0",
              fontSize: "var(--font-size-base)",
              color: "var(--color-gray-600)",
              fontWeight: 600,
            }}
          >
            內部排班管理系統
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "var(--font-size-xs)",
              color: "var(--color-secondary)",
              letterSpacing: "0.05em",
            }}
          >
            特殊寵物專科
          </p>
        </div>

        <div
          style={{
            width: "100%",
            height: "1px",
            background: "var(--color-border)",
            margin: "var(--space-2) 0",
          }}
        />

        <p
          style={{
            margin: 0,
            fontSize: "var(--font-size-sm)",
            color: "var(--color-gray-500)",
            textAlign: "center",
          }}
        >
          請使用已註冊的 Google 帳號登入
        </p>

        <button
          className="btn btn-primary btn-lg"
          onClick={handleLogin}
          disabled={signingIn}
          style={{ width: "100%", gap: "var(--space-2)" }}
        >
          {signingIn ? (
            <>
              <div className="spinner" style={{ width: "1.1rem", height: "1.1rem", borderWidth: "2px" }} />
              登入中…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgba(255,255,255,0.85)"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="rgba(255,255,255,0.7)"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgba(255,255,255,0.9)"/>
              </svg>
              使用 Google 登入
            </>
          )}
        </button>

        {error && (
          <div className="alert alert-error" style={{ width: "100%", textAlign: "center" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
