import { FormEvent, useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Mail, X } from 'lucide-react';
import { loginAdmin, loginAdminWithGoogle } from '../data/authRepository';
import avapexLogo from '../../../assets/images/avapex_transportes_logo.png';
import googleLogo from '../../../assets/images/google_logo.png';

type LoginPageProps = {
  onSignedIn: () => void;
  message?: string;
};

export function LoginPage({ onSignedIn, message }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(message ?? '');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  async function handleGoogleLogin() {
    setError('');
    setGoogleLoading(true);

    try {
      await loginAdminWithGoogle();
      onSignedIn();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Erro ao entrar com Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#211D1D] px-6 py-8 text-white">
      <section className="flex min-h-[min(760px,calc(100vh-64px))] w-full max-w-[420px] flex-col justify-center">
        <div className="mb-20 flex justify-center">
          <img className="h-[72px] w-auto object-contain" src={avapexLogo} alt="Avapex Transportes" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">
          <label className="relative block">
            <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white" size={28} />
            <input
              className="h-[54px] w-full rounded-2xl border border-[#E8E1DF] bg-transparent pl-[58px] pr-4 text-sm text-white outline-none placeholder:text-white focus:border-white focus:ring-1 focus:ring-white"
              type="email"
              placeholder="Digite o email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="relative block">
            <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white" size={28} />
            <input
              className="h-[54px] w-full rounded-2xl border border-[#E8E1DF] bg-transparent pl-[58px] pr-[94px] text-sm text-white outline-none placeholder:text-white focus:border-white focus:ring-1 focus:ring-white"
              type={showPassword ? 'text' : 'password'}
              placeholder="Digite a senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
              {password ? (
                <button
                  aria-label="Limpar senha"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white hover:bg-white/10"
                  onClick={() => setPassword('')}
                  type="button"
                >
                  <X size={20} />
                </button>
              ) : null}
              <button
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white hover:bg-white/10"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
              </button>
            </div>
          </label>

          <div className="-mt-5 flex justify-end">
            <button className="text-sm text-white hover:underline" type="button">
              Esqueceu a senha?
            </button>
          </div>

          {error ? (
            <p className="rounded-2xl border border-[#B8B8B8] bg-white px-3 py-3 text-sm font-semibold text-black">
              {error}
            </p>
          ) : null}

          <button
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-white font-medium text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || googleLoading}
            type="submit"
          >
            <LogIn size={20} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            className="flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-white font-medium text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || googleLoading}
            onClick={() => void handleGoogleLogin()}
            type="button"
          >
            {googleLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
            ) : (
              <img className="h-[22px] w-[22px]" src={googleLogo} alt="" />
            )}
            {googleLoading ? 'Conectando...' : 'Entrar com Google'}
          </button>
        </form>

        <p className="mt-24 text-center text-xs text-white">Desenvolvido por @GabrielOtavio</p>
      </section>
    </main>
  );
}
