import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '../../../core/firebase/firebaseConfig';
import { mapFirebaseError } from '../../../core/firebase/firebaseErrors';
import { mapUser } from '../../shared/data/mappers';
import type { AppUser } from '../../shared/domain/models';
import { normalizeCpf } from '../../shared/utils/cpf';

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

export async function loginAdmin(identifier: string, password: string): Promise<AdminSession> {
  try {
    const email = await resolveEmailIdentifier(identifier);
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

export async function loginAdminWithGoogle(): Promise<AdminSession> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(auth, provider);
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
    throw mapFirebaseError(error, 'Erro ao entrar com Google no painel administrativo.');
  }
}

export async function logoutAdmin() {
  await signOut(auth);
}

export async function requestAdminPasswordReset(identifier: string) {
  try {
    const trimmedEmail = await resolveEmailIdentifier(identifier);
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      throw new Error('Informe um e-mail ou CPF valido para recuperar a senha.');
    }

    await sendPasswordResetEmail(auth, trimmedEmail, {
      url: window.location.origin,
      handleCodeInApp: false,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('e-mail') || error.message.includes('CPF'))) {
      throw error;
    }
    if (error instanceof FirebaseError && error.code === 'auth/user-not-found') {
      return;
    }
    throw mapFirebaseError(error, 'Erro ao enviar recuperacao de senha.');
  }
}

async function resolveEmailIdentifier(identifier: string) {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }

  const cpf = normalizeCpf(trimmed);
  if (!cpf) {
    throw new Error('Informe um e-mail ou CPF valido.');
  }

  const snapshot = await getDoc(doc(firestore, 'loginIdentifiers', cpf));
  if (!snapshot.exists()) {
    throw new Error('CPF nao encontrado.');
  }

  const email = snapshot.data().email;
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('CPF sem e-mail vinculado.');
  }
  return email.trim().toLowerCase();
}
