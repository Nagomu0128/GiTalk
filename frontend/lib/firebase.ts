import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const getFirebaseApp = (): FirebaseApp => {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(firebaseConfig);
};

let _auth: Auth | undefined;

export const getFirebaseAuth = (): Auth => {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp());
  }
  return _auth;
};
