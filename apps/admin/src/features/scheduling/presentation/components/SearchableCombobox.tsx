import { Check, ChevronDown, Search } from 'lucide-react';
import { type ReactNode, useId, useMemo, useRef, useState } from 'react';

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

type SearchableComboboxProps = {
  allowCustom?: boolean;
  disabled?: boolean;
  error?: string;
  icon?: ReactNode;
  label: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder: string;
  required?: boolean;
  value: string;
};

export function SearchableCombobox({
  allowCustom = false,
  disabled = false,
  error,
  icon,
  label,
  onChange,
  options,
  placeholder,
  required = false,
  value,
}: SearchableComboboxProps) {
  const selected = options.find((option) => option.value === value);
  const [draftQuery, setDraftQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);
  const listboxId = useId();
  const query = draftQuery ?? selected?.label ?? value;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalized || selected?.label === query) {
      return options.slice(0, 12);
    }
    return options
      .filter((option) => `${option.label} ${option.description ?? ''} ${option.searchText ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalized))
      .slice(0, 12);
  }, [options, query, selected?.label]);

  function closeAfterBlur() {
    blurTimer.current = window.setTimeout(() => {
      setOpen(false);
      setDraftQuery(null);
    }, 120);
  }

  function selectOption(option: ComboboxOption) {
    if (blurTimer.current) {
      window.clearTimeout(blurTimer.current);
    }
    onChange(option.value);
    setDraftQuery(null);
    setOpen(false);
  }

  return (
    <label className="relative block min-w-0">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
        {icon}
        {label}
        {required ? <span className="text-red-600">*</span> : null}
      </span>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          className={`ui-input h-11 w-full px-9 pr-10 text-sm ${error ? 'border-red-500 focus:border-red-500' : ''}`}
          disabled={disabled}
          onBlur={closeAfterBlur}
          onChange={(event) => {
            const next = event.target.value;
            setDraftQuery(next);
            setOpen(true);
            if (allowCustom) {
              onChange(next);
            } else if (!next) {
              onChange('');
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          required={required}
          role="combobox"
          value={query}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
      </span>
      {open && !disabled ? (
        <span className="absolute z-50 mt-1 block max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-xl" id={listboxId} role="listbox">
          {filtered.length > 0 ? filtered.map((option) => (
            <button
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-zinc-100"
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
              role="option"
              aria-selected={option.value === value}
              type="button"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">{option.label}</span>
                {option.description ? <span className="block truncate text-xs text-zinc-500">{option.description}</span> : null}
              </span>
              {option.value === value ? <Check className="shrink-0 text-zinc-900" size={16} /> : null}
            </button>
          )) : (
            <span className="block px-3 py-3 text-sm text-zinc-500">
              {allowCustom ? 'Use o texto informado.' : 'Nenhum registro encontrado.'}
            </span>
          )}
        </span>
      ) : null}
      {error ? <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}
