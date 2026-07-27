import { FirebaseError, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

type FirebaseEnv = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const requiredEnv: Record<keyof FirebaseEnv, string | undefined> = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function readFirebaseEnv(): FirebaseEnv {
  const missing = Object.entries(requiredEnv)
    .filter(([, value]) => !value)
    .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);

  if (missing.length > 0) {
    throw new Error(`Firebase admin env ausente: ${missing.join(', ')}`);
  }

  return requiredEnv as FirebaseEnv;
}

export const firebaseOptions = readFirebaseEnv();

function initializeFirebaseApp() {
  try {
    return initializeApp(firebaseOptions);
  } catch (error) {
    if (error instanceof FirebaseError) {
      throw new Error(`Falha ao inicializar Firebase Admin: ${error.code}`);
    }
    throw error;
  }
}

export const firebaseApp = initializeFirebaseApp();
export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
