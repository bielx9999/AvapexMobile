import { FormEvent, useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { loginAdmin } from '../data/authRepository';

type LoginPageProps = {
  onSignedIn: () => void;
  message?: string;
};

export function LoginPage({ onSignedIn, message }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(message ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginAdmin(email.trim(), password);
      onSignedIn();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Erro ao entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-avapex-black px-4 py-8">
      <section className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-avapex-yellow text-avapex-black">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Avapex Admin</h1>
            <p className="text-sm text-zinc-300">Painel de gestao logistica</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded bg-white p-6 shadow-xl">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Email administrativo</span>
            <input
              className="h-12 w-full rounded border border-zinc-300 px-3 outline-none focus:border-avapex-yellow focus:ring-2 focus:ring-avapex-yellow/40"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Senha</span>
            <input
              className="h-12 w-full rounded border border-zinc-300 px-3 outline-none focus:border-avapex-yellow focus:ring-2 focus:ring-avapex-yellow/40"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded bg-avapex-yellow font-semibold text-avapex-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            <LogIn size={20} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
