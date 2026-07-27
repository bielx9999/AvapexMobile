import { FirebaseError } from 'firebase/app';

export type AdminFirebaseFailureCode =
  | 'permission-denied'
  | 'unauthenticated'
  | 'unavailable'
  | 'deadline-exceeded'
  | 'not-found'
  | 'unknown';

export class AdminFirebaseFailure extends Error {
  constructor(
    readonly code: AdminFirebaseFailureCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AdminFirebaseFailure';
  }
}

export function mapFirebaseError(error: unknown, fallbackMessage: string): AdminFirebaseFailure {
  if (error instanceof FirebaseError) {
    const code = error.code.replace(/^firestore\//, '').replace(/^auth\//, '');

    if (code === 'permission-denied') {
      return new AdminFirebaseFailure('permission-denied', 'Permissao negada para esta operacao.', error);
    }
    if (code === 'unauthenticated') {
      return new AdminFirebaseFailure('unauthenticated', 'Sessao expirada. Entre novamente.', error);
    }
    if (code === 'unavailable') {
      return new AdminFirebaseFailure('unavailable', 'Firebase indisponivel ou sem conexao.', error);
    }
    if (code === 'deadline-exceeded') {
      return new AdminFirebaseFailure('deadline-exceeded', 'Tempo limite excedido na consulta.', error);
    }
    if (code === 'not-found') {
      return new AdminFirebaseFailure('not-found', 'Registro nao encontrado.', error);
    }
  }

  return new AdminFirebaseFailure('unknown', fallbackMessage, error);
}
