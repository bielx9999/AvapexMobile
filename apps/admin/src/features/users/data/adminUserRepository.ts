import { FirebaseError, getApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { deleteDoc, deleteField, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, firebaseOptions, firestore } from '../../../core/firebase/firebaseConfig';
import { mapFirebaseError } from '../../../core/firebase/firebaseErrors';
import type { AppUser, UserRole, UserStatus } from '../../shared/domain/models';

export type CreateAdminUserInput = {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  cnhNumber?: string;
  cnhCategory?: string;
  cnhExpirationDate?: string;
};

export type UpdateAdminUserInput = {
  uid: string;
  name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  cnhNumber?: string;
  cnhCategory?: string;
  cnhExpirationDate?: string;
};

const secondaryAppName = 'admin-user-provisioning';

function getProvisioningAuth() {
  const secondaryApp = getApps().some((app) => app.name === secondaryAppName)
    ? getApp(secondaryAppName)
    : initializeApp(firebaseOptions, secondaryAppName);
  return getAuth(secondaryApp);
}

export const adminUserRepository = {
  async createUser(input: CreateAdminUserInput): Promise<string> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const phone = input.phone.trim();

    if (!name || !email || input.password.length < 6) {
      throw new Error('Informe nome, email e senha com pelo menos 6 caracteres.');
    }

    if (input.role === 'driver' && (!input.cnhNumber || !input.cnhCategory || !input.cnhExpirationDate)) {
      throw new Error('Motorista precisa de numero, categoria e validade da CNH.');
    }

    const provisioningAuth = getProvisioningAuth();

    try {
      const credential = await createUserWithEmailAndPassword(provisioningAuth, email, input.password);
      await signOut(provisioningAuth);

      const uid = credential.user.uid;
      await setDoc(doc(firestore, 'users', uid), {
        uid,
        name,
        email,
        phone,
        role: input.role,
        status: 'active' satisfies UserStatus,
        createdAt: serverTimestamp(),
        ...(input.role === 'driver'
          ? {
              cnh: {
                number: input.cnhNumber?.trim(),
                category: input.cnhCategory?.trim().toUpperCase(),
                expirationDate: new Date(`${input.cnhExpirationDate}T12:00:00`),
              },
            }
          : {}),
      });

      return uid;
    } catch (error) {
      if (error instanceof FirebaseError && error.code === 'auth/email-already-in-use') {
        throw new Error('Este email ja esta cadastrado no Firebase Auth.');
      }
      throw mapFirebaseError(error, 'Erro ao criar usuario.');
    }
  },

  async sendPasswordReset(user: AppUser) {
    try {
      await sendPasswordResetEmail(auth, user.email);
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao enviar redefinicao de senha.');
    }
  },

  async updateUser(input: UpdateAdminUserInput) {
    const name = input.name.trim();
    const phone = input.phone.trim();

    if (!name) {
      throw new Error('Informe o nome do usuario.');
    }

    if (input.role === 'driver' && (!input.cnhNumber || !input.cnhCategory || !input.cnhExpirationDate)) {
      throw new Error('Motorista precisa de numero, categoria e validade da CNH.');
    }

    try {
      await updateDoc(doc(firestore, 'users', input.uid), {
        name,
        phone,
        role: input.role,
        status: input.status,
        cnh:
          input.role === 'driver'
            ? {
                number: input.cnhNumber?.trim(),
                category: input.cnhCategory?.trim().toUpperCase(),
                expirationDate: new Date(`${input.cnhExpirationDate}T12:00:00`),
              }
            : deleteField(),
      });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao atualizar usuario.');
    }
  },

  async setStatus(uid: string, status: UserStatus) {
    try {
      await updateDoc(doc(firestore, 'users', uid), { status });
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao alterar status do usuario.');
    }
  },

  async deleteProfile(uid: string) {
    try {
      await deleteDoc(doc(firestore, 'users', uid));
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao excluir cadastro do usuario.');
    }
  },
};
