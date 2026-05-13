import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { User } from "../types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  loginError: string;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    // Handle Google redirect sign-in result (fallback for browsers that block popups).
    // We track redirect attempts in localStorage so we can detect when iOS Safari's ITP
    // wipes sessionStorage between origins (127.0.0.1 ↔ localhost), causing
    // getRedirectResult to silently return null even though the user completed Google auth.
    const REDIRECT_FLAG = "__fb_redirect_pending";
    getRedirectResult(auth)
      .then((result) => {
        const hadPendingRedirect = localStorage.getItem(REDIRECT_FLAG);
        localStorage.removeItem(REDIRECT_FLAG);
        if (!result && hadPendingRedirect) {
          // Redirect completed but Firebase lost the session state (Safari ITP / storage
          // partitioning). Tell the user to retry in a first-party browser context.
          setLoginError("登入狀態遺失，請直接以 Safari 或 Chrome 開啟此頁面後重試");
        }
      })
      .catch((err: { code?: string }) => {
        localStorage.removeItem(REDIRECT_FLAG);
        if (err?.code) {
          setLoginError("帳號未授權，請確認帳密，或請洽管理員");
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser?.email) {
        const snap = await getDoc(doc(db, "users", fbUser.email));
        setUserProfile(snap.exists() ? (snap.data() as User) : null);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // Popup-first: works on all modern browsers including mobile Safari.
    // Redirect flow is only used as fallback when the browser actively blocks popups
    // (some in-app browsers such as LINE / Instagram). The previous redirect-first
    // approach was fragile because sessionStorage is often cleared during the
    // cross-origin redirect, causing getRedirectResult to silently return null.
    try {
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        // Browser blocked the popup window — fall back to full-page redirect.
        // Mark the attempt so getRedirectResult can detect a lost-state scenario.
        localStorage.setItem("__fb_redirect_pending", "true");
        await signInWithRedirect(auth, provider);
      } else {
        throw err;
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ firebaseUser, userProfile, loading, loginError, signInWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
