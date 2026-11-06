import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, X, Plus, Check, Inbox } from 'lucide-react';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const ref = useRef<HTMLDivElement>(null),
    titleId = useId();
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = ref.current;
    const items = () =>
      [
        ...(root?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ) ?? []),
      ].filter((n) => n.offsetParent !== null);
    const target = root?.querySelector<HTMLElement>('[data-autofocus]') ?? items()[0];
    target?.focus();
    const key = (e: KeyboardEvent) => {
      if ([...document.querySelectorAll('[role=dialog]')].at(-1) !== root) return;
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab') {
        const list = items(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', key);
      old?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal ${wide ? 'modal-wide' : ''}`}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Confirm({
  title,
  description,
  onClose,
  onConfirm,
  danger = true,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted leading-relaxed">{description}</p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          disabled={busy}
          className={`btn ${danger ? 'danger' : 'primary'}`}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not complete this action.');
              setBusy(false);
            }
          }}
        >
          {busy ? 'Working…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
export function Empty({
  title,
  text,
  action,
  onAction,
  compact = false,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`empty ${compact ? 'compact' : ''}`}>
      <span className="empty-icon">
        <Inbox size={24} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="btn secondary" onClick={onAction}>
          <Plus size={15} />
          {action}
        </button>
      )}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {title}
          <span className="accent">.</span>
        </h1>
        <p>{text}</p>
      </div>
      <div className="page-actions">{children}</div>
    </header>
  );
}
export function SectionTitle({
  title,
  count,
  action,
  onAction,
}: {
  title: string;
  count?: number;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-heading">
      <h2>
        {title}
        {count !== undefined && <span className="count">{count}</span>}
      </h2>
      {action && (
        <button className="text-btn" onClick={onAction}>
          {action}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}
export function CheckButton({
  checked,
  onClick,
  label,
  disabled = false,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={`check-button ${checked ? 'checked' : ''}`}
      aria-label={label}
      aria-pressed={checked}
      onClick={onClick}
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}
export function Stat({
  icon,
  label,
  value,
  detail,
  tone = '',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail: string;
  tone?: string;
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <p>{detail}</p>
    </div>
  );
}
