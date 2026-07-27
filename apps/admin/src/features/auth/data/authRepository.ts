import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '../../../core/firebase/firebaseConfig';
import { mapFirebaseError } from '../../../core/firebase/firebaseErrors';
import { mapUser } from '../../shared/data/mappers';
import type { AppUser } from '../../shared/domain/models';

export type AdminSession = {
  firebaseUser: User;
  profile: AppUser;
};

export function observeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function loadUserProfile(uid: string): Promise<AppUser | null> {
  try {
    const snapshot = await getDoc(doc(firestore, 'users', uid));
    if (!snapshot.exists()) {
      return null;
    }
    return mapUser(snapshot.id, snapshot.data());
  } catch (error) {
    throw mapFirebaseError(error, 'Erro ao carregar perfil do usuario.');
  }
}

export async function loginAdmin(email: string, password: string): Promise<AdminSession> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await loadUserProfile(credential.user.uid);

    if (!profile || profile.role !== 'admin') {
      await signOut(auth);
      throw new Error('Este usuario nao possui permissao administrativa.');
    }

    return {
      firebaseUser: credential.user,
      profile,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('permissao administrativa')) {
      throw error;
    }
    throw mapFirebaseError(error, 'Erro ao entrar no painel administrativo.');
  }
}

export async function logoutAdmin() {
  await signOut(auth);
}
