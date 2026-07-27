import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Ban, KeyRound, Plus, Search, Trash2, UserCheck } from 'lucide-react';
import { adminUserRepository } from '../data/adminUserRepository';
import type { AppUser, UserRole } from '../../shared/domain/models';

type UsersPageProps = {
  users: AppUser[];
  loading: boolean;
  currentUid: string;
  onChanged: () => Promise<void>;
};

const initialForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'driver' as UserRole,
  cnhNumber: '',
  cnhCategory: '',
  cnhExpirationDate: '',
};

export function UsersPage({ users, loading, currentUid, onChanged }: UsersPageProps) {
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyUid, setBusyUid] = useState('');

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return users;
    }
    return users.filter((user) =>
      [user.name, user.email, user.phone, user.role, user.status]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, users]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      await adminUserRepository.createUser(form);
      setForm(initialForm);
      setMessage('Usuario criado com sucesso.');
      await onChanged();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Erro ao criar usuario.');
    } finally {
      setSubmitting(false);
    }
  }

  async function runUserAction(uid: string, action: () => Promise<void>, successMessage: string) {
    setBusyUid(uid);
    setError('');
    setMessage('');

    try {
      await action();
      setMessage(successMessage);
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao executar acao.');
    } finally {
      setBusyUid('');
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="font-semibold">Criar usuario</h2>
          <p className="mt-1 text-sm text-zinc-500">Cadastro por email e senha, sem acesso Google obrigatorio.</p>
        </div>

        <form className="grid gap-4 p-4 lg:grid-cols-4" onSubmit={handleCreateUser}>
          <TextField
            label="Nome e sobrenome"
            value={form.name}
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            required
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            required
          />
          <TextField
            label="Telefone"
            value={form.phone}
            onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
          />
          <TextField
            label="Senha provisoria"
            type="password"
            minLength={6}
            value={form.password}
            onChange={(value) => setForm((current) => ({ ...current, password: value }))}
            required
          />

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Tipo de usuario</span>
            <select
              className="h-11 w-full rounded border border-zinc-300 bg-white px-3 outline-none focus:border-avapex-yellow focus:ring-2 focus:ring-avapex-yellow/30"
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
            >
              <option value="driver">Motorista</option>
              <option value="admin">Administrativo</option>
            </select>
          </label>

          {form.role === 'driver' ? (
            <>
              <TextField
                label="Numero CNH"
                value={form.cnhNumber}
                onChange={(value) => setForm((current) => ({ ...current, cnhNumber: value }))}
                required
              />
              <TextField
                label="Categoria CNH"
                value={form.cnhCategory}
                onChange={(value) => setForm((current) => ({ ...current, cnhCategory: value }))}
                required
              />
              <TextField
                label="Validade CNH"
                type="date"
                value={form.cnhExpirationDate}
                onChange={(value) => setForm((current) => ({ ...current, cnhExpirationDate: value }))}
                required
              />
            </>
          ) : null}

          <div className="flex items-end">
            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded bg-avapex-yellow px-4 font-semibold text-avapex-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              <Plus size={18} />
              {submitting ? 'Criando...' : 'Criar usuario'}
            </button>
          </div>
        </form>
      </section>

      {message ? <p className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="rounded border border-zinc-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">Gerenciar usuarios</h2>
            <p className="mt-1 text-sm text-zinc-500">Bloqueio, redefinicao de senha e exclusao de cadastro.</p>
          </div>
          <label className="relative block md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              className="h-10 w-full rounded border border-zinc-300 pl-10 pr-3 text-sm outline-none focus:border-avapex-yellow focus:ring-2 focus:ring-avapex-yellow/30"
              placeholder="Buscar usuario"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr className="border-t border-zinc-100" key={user.uid}>
                  <td className="px-4 py-3 font-medium">{user.name || '-'}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.phone || '-'}</td>
                  <td className="px-4 py-3">{user.role === 'admin' ? 'Administrativo' : 'Motorista'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        user.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {user.status === 'active' ? 'Ativo' : 'Bloqueado'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {user.uid === currentUid ? (
                        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600">Voce</span>
                      ) : null}
                      <IconButton
                        label="Enviar redefinicao de senha"
                        disabled={busyUid === user.uid}
                        onClick={() =>
                          void runUserAction(
                            user.uid,
                            () => adminUserRepository.sendPasswordReset(user),
                            'Email de redefinicao enviado.',
                          )
                        }
                      >
                        <KeyRound size={17} />
                      </IconButton>
                      <IconButton
                        label={user.status === 'active' ? 'Bloquear usuario' : 'Ativar usuario'}
                        disabled={busyUid === user.uid || user.uid === currentUid}
                        onClick={() =>
                          void runUserAction(
                            user.uid,
                            () => adminUserRepository.setStatus(user.uid, user.status === 'active' ? 'inactive' : 'active'),
                            user.status === 'active' ? 'Usuario bloqueado.' : 'Usuario ativado.',
                          )
                        }
                      >
                        {user.status === 'active' ? <Ban size={17} /> : <UserCheck size={17} />}
                      </IconButton>
                      <IconButton
                        danger
                        label="Excluir cadastro"
                        disabled={busyUid === user.uid || user.uid === currentUid}
                        onClick={() => {
                          const confirmed = window.confirm(
                            'Excluir o cadastro do Firestore? A conta no Firebase Auth so sera removida quando configurarmos Cloud Functions.',
                          );
                          if (!confirmed) {
                            return;
                          }
                          void runUserAction(
                            user.uid,
                            () => adminUserRepository.deleteProfile(user.uid),
                            'Cadastro excluido do Firestore.',
                          );
                        }}
                      >
                        <Trash2 size={17} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredUsers.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={7}>
                    Nenhum usuario encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
};

function TextField({ label, value, onChange, type = 'text', required, minLength }: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-700">{label}</span>
      <input
        className="h-11 w-full rounded border border-zinc-300 px-3 outline-none focus:border-avapex-yellow focus:ring-2 focus:ring-avapex-yellow/30"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
      />
    </label>
  );
}

type IconButtonProps = {
  children: ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
};

function IconButton({ children, label, disabled, danger, onClick }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded border transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? 'border-red-200 text-red-700 hover:bg-red-50'
          : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function formatDate(value: Date | null) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}
