import { AdminDashboard } from '../features/dashboard/presentation/AdminDashboard';
import { LoginPage } from '../features/auth/presentation/LoginPage';
import { useAdminSession } from '../features/auth/application/useAdminSession';

export function App() {
  const sessionState = useAdminSession();

  if (sessionState.status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-avapex-black text-white">
        <p>Carregando painel administrativo...</p>
      </main>
    );
  }

  if (sessionState.status === 'signed_in') {
    return <AdminDashboard session={sessionState.session} />;
  }

  return <LoginPage message={sessionState.message} onSignedIn={() => undefined} />;
}
