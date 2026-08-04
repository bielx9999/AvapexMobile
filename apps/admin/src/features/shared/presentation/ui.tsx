import type { ReactNode } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';

export type MetricTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: number | string;
  tone?: MetricTone;
};

const metricToneClasses: Record<MetricTone, { dot: string; icon: string }> = {
  accent: { dot: 'bg-avapex-yellow', icon: 'bg-yellow-50 text-yellow-700' },
  danger: { dot: 'bg-red-500', icon: 'bg-red-50 text-red-700' },
  info: { dot: 'bg-sky-500', icon: 'bg-sky-50 text-sky-700' },
  neutral: { dot: 'bg-zinc-400', icon: 'bg-zinc-100 text-zinc-700' },
  success: { dot: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-700' },
  warning: { dot: 'bg-amber-500', icon: 'bg-amber-50 text-amber-700' },
};

export function MetricCard({ icon, label, value, tone = 'neutral' }: MetricCardProps) {
  const styles = metricToneClasses[tone];

  return (
    <article className="ui-card flex min-h-24 items-center gap-3 p-3 sm:p-4">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${styles.icon}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
          <p className="text-[11px] font-medium leading-tight text-zinc-500 sm:text-xs">{label}</p>
        </div>
        <strong className="mt-1 block text-2xl font-semibold leading-none text-zinc-950">{value}</strong>
      </div>
    </article>
  );
}

type ActionIconButtonProps = {
  children: ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
};

export function ActionIconButton({ children, label, disabled, danger, onClick }: ActionIconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`ui-icon-button h-9 w-9 bg-white ${
        danger
          ? 'border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50'
          : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-950'
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

export function ErrorBanner({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="ui-error" role="alert">
      <AlertCircle className="mt-0.5 shrink-0" size={17} />
      <span>{message}</span>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
        <Inbox size={19} />
      </span>
      <p className="text-sm font-semibold text-zinc-800">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-zinc-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <div aria-label="Carregando dados" className="animate-pulse p-4" role="status">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className="grid gap-4 border-b border-zinc-100 py-3 last:border-0" key={rowIndex} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <span className="h-4 rounded bg-zinc-100" key={columnIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-label="Carregando pagina" className="animate-pulse space-y-5" role="status">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="ui-card h-24 bg-white p-4" key={index}>
            <span className="block h-3 w-24 rounded bg-zinc-100" />
            <span className="mt-5 block h-7 w-16 rounded bg-zinc-100" />
          </div>
        ))}
      </div>
      <div className="ui-card h-80 bg-white p-4">
        <span className="block h-4 w-40 rounded bg-zinc-100" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <span className="block h-8 rounded bg-zinc-50" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
