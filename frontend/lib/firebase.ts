"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const readFirebaseEnv = (value: string | undefined) => {
  if (!value) throw new Error("Missing Firebase env");
  return value.trim();
};

const firebaseConfig = {
  apiKey: readFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: readFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: readFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: readFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: readFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: readFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: readFirebaseEnv(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
};

export const hasPlaceholderFirebaseConfig = Object.values(firebaseConfig).some(
  (value) => !value || value === "XYZ",
);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);

// Keep Firestore usage limited to auth profile storage so we can swap this out
// for a PostgreSQL-backed API later without changing the sign-in UI again.
export const firestore = getFirestore(app);

export const googleAuthProvider = new GoogleAuthProvider();

googleAuthProvider.setCustomParameters({ prompt: "select_account" });
