import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// TODO: Replace with your Firebase project config from the Firebase Console
// (Project Settings → Your apps → Web app → SDK setup and configuration)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-northeast1");

// Connect to local Emulator Suite when running in dev mode
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);

  // Playwright E2E helper — programmatic auth without popup
  (window as Window & {
    __e2eSignIn?: (email: string, pw: string) => Promise<unknown>;
    __e2eSignOut?: () => Promise<void>;
  }).__e2eSignIn = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
  (window as Window & { __e2eSignOut?: () => Promise<void> }).__e2eSignOut =
    () => signOut(auth);
}
