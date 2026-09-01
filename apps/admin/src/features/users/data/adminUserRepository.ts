import { FirebaseError, getApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { deleteField, doc, getDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, firebaseOptions, firestore } from '../../../core/firebase/firebaseConfig';
import { mapFirebaseError } from '../../../core/firebase/firebaseErrors';
import { normalizeCpf } from '../../shared/utils/cpf';
import type { AppUser, UserRole, UserStatus } from '../../shared/domain/models';

export type CreateAdminUserInput = {
  name: string;
  email: string;
  cpf: string;
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
  cpf: string;
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
    const cpf = normalizeCpf(input.cpf);

    if (!name || !email || !cpf || input.password.length < 6) {
      throw new Error('Informe nome, email, CPF valido e senha com pelo menos 6 caracteres.');
    }

    if (input.role === 'driver' && (!input.cnhNumber || !input.cnhCategory || !input.cnhExpirationDate)) {
      throw new Error('Motorista precisa de numero, categoria e validade da CNH.');
    }

    const provisioningAuth = getProvisioningAuth();

    try {
      await assertCpfAvailable(cpf);
      const credential = await createUserWithEmailAndPassword(provisioningAuth, email, input.password);
      await signOut(provisioningAuth);

      const uid = credential.user.uid;
      const batch = writeBatch(firestore);
      batch.set(doc(firestore, 'users', uid), {
        uid,
        name,
        email,
        cpf,
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
      batch.set(doc(firestore, 'loginIdentifiers', cpf), {
        uid,
        email,
        cpf,
        kind: 'cpf',
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      return uid;
    } catch (error) {
      if (error instanceof FirebaseError && error.code === 'auth/email-already-in-use') {
        throw new Error('Este email ja esta cadastrado no Firebase Auth.');
      }
      throw mapFirebaseError(error, 'Erro ao criar usuario.');
    }
  },

  async importUsers(inputs: CreateAdminUserInput[]) {
    for (const input of inputs) {
      await this.createUser(input);
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
    const cpf = normalizeCpf(input.cpf);

    if (!name || !cpf) {
      throw new Error('Informe o nome e um CPF valido.');
    }

    if (input.role === 'driver' && (!input.cnhNumber || !input.cnhCategory || !input.cnhExpirationDate)) {
      throw new Error('Motorista precisa de numero, categoria e validade da CNH.');
    }

    try {
      const userRef = doc(firestore, 'users', input.uid);
      const snapshot = await getDoc(userRef);
      const existing = snapshot.exists() ? snapshot.data() : null;
      const oldCpf = typeof existing?.cpf === 'string' ? existing.cpf : '';
      const email = typeof existing?.email === 'string' ? existing.email : '';
      if (!email) {
        throw new Error('Usuario sem e-mail cadastrado.');
      }
      if (oldCpf !== cpf) {
        await assertCpfAvailable(cpf, input.uid);
      }

      const batch = writeBatch(firestore);
      batch.update(userRef, {
        name,
        cpf,
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
      if (oldCpf && oldCpf !== cpf) {
        batch.delete(doc(firestore, 'loginIdentifiers', oldCpf));
      }
      batch.set(doc(firestore, 'loginIdentifiers', cpf), {
        uid: input.uid,
        email,
        cpf,
        kind: 'cpf',
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
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
      const userRef = doc(firestore, 'users', uid);
      const snapshot = await getDoc(userRef);
      const cpf = snapshot.exists() && typeof snapshot.data().cpf === 'string' ? snapshot.data().cpf : '';
      const batch = writeBatch(firestore);
      batch.delete(userRef);
      if (cpf) {
        batch.delete(doc(firestore, 'loginIdentifiers', cpf));
      }
      await batch.commit();
    } catch (error) {
      throw mapFirebaseError(error, 'Erro ao excluir cadastro do usuario.');
    }
  },
};

async function assertCpfAvailable(cpf: string, currentUid?: string) {
  const snapshot = await getDoc(doc(firestore, 'loginIdentifiers', cpf));
  if (!snapshot.exists()) {
    return;
  }
  const uid = snapshot.data().uid;
  if (!currentUid || uid !== currentUid) {
    throw new Error('Este CPF ja esta cadastrado para outro usuario.');
  }
}
