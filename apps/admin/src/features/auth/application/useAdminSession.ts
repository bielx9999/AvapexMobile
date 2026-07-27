import { useEffect, useState } from 'react';
import { observeAuth, loadUserProfile, type AdminSession } from '../data/authRepository';

type SessionState =
  | { status: 'loading'; session: null; message?: string }
  | { status: 'signed_out'; session: null; message?: string }
  | { status: 'forbidden'; session: null; message: string }
  | { status: 'signed_in'; session: AdminSession; message?: string };

export function useAdminSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  useEffect(() => {
    return observeAuth(async (firebaseUser) => {
      if (!firebaseUser) {
        setState({ status: 'signed_out', session: null });
        return;
      }

      try {
        const profile = await loadUserProfile(firebaseUser.uid);
        if (!profile || profile.role !== 'admin') {
          setState({
            status: 'forbidden',
            session: null,
            message: 'Seu usuario nao possui permissao administrativa.',
          });
          return;
        }
        setState({ status: 'signed_in', session: { firebaseUser, profile } });
      } catch (error) {
        setState({
          status: 'forbidden',
          session: null,
          message: error instanceof Error ? error.message : 'Erro ao validar permissao.',
        });
      }
    });
  }, []);

  return state;
}
