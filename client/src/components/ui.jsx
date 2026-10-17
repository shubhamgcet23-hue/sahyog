import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { cn, REQUEST_STATUS, TYPE_META } from '../utils/constants';
import { imgSrc, initials } from '../utils/format';

/* ---------- feedback states ---------- */

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={cn('animate-spin text-brand-600', className)} viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-stone-500" aria-live="polite">
      <Spinner className="h-8 w-8" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry, title = 'Something went wrong' }) {
  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center gap-3 p-8 text-center" role="alert">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600"><Icon name="alert" /></span>
      <h2 className="text-lg">{title}</h2>
      <p className="text-sm text-stone-600">{message}</p>
      {onRetry && <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ icon = 'box', title, text, action }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon name={icon} /></span>
      <h3 className="text-lg">{title}</h3>
      {text && <p className="text-sm text-stone-600">{text}</p>}
      {action}
    </div>
  );
}

/** Renders loading / error / empty / content for a useFetch result. */
export function Async({ state, empty, children, isEmpty }) {
  if (state.loading && !state.data) return <PageLoader />;
  if (state.error && !state.data) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (isEmpty ? isEmpty(state.data) : Array.isArray(state.data) && state.data.length === 0) return empty || null;
  return children(state.data, state.meta);
}

/* ---------- layout helpers ---------- */

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-stone-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'brand' }) {
  const tones = { brand: 'bg-brand-50 text-brand-700', saffron: 'bg-saffron-100 text-saffron-700', red: 'bg-red-50 text-red-600', sky: 'bg-sky-50 text-sky-700' };
  return (
    <div className="card flex items-start gap-3 p-4">
      {icon && <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tones[tone])}><Icon name={icon} className="h-5 w-5" /></span>}
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight text-brand-900">{value}</p>
        <p className="text-sm text-stone-600">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  return (
    <div role="tablist" aria-label={label} className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-stone-200/60 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn('whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition', value === t.key ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-600 hover:text-stone-900')}
        >
          {t.label}{t.count !== undefined && t.count !== null && <span className="ml-1.5 rounded-full bg-stone-200 px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SafetyNotice({ compact = false }) {
  return (
    <div className={cn('flex gap-3 rounded-2xl border border-red-200 bg-red-50 text-red-900', compact ? 'p-3 text-xs' : 'p-4 text-sm')} role="note">
      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      <p>
        <strong>Sahyog is a community coordination platform, not an emergency-response service.</strong> If someone is in immediate danger, call{' '}
        <a className="font-bold underline" href="tel:112">112</a> (India) or your local emergency number, or contact the nearest hospital or police station. Never share bank details, OTPs or exact home addresses publicly.
      </p>
    </div>
  );
}

/* ---------- badges ---------- */

export function Badge({ children, cls = 'bg-stone-100 text-stone-700 ring-stone-200', className }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', cls, className)}>{children}</span>;
}

export function StatusBadge({ status, map = REQUEST_STATUS }) {
  const m = map[status] || { label: status, cls: undefined };
  return <Badge cls={m.cls}>{m.label}</Badge>;
}

export function TypeBadge({ type }) {
  const m = TYPE_META[type];
  if (!m) return null;
  return <Badge cls={m.cls}><Icon name={m.icon} className="h-3 w-3" />{m.label}</Badge>;
}

export function VerifiedBadge({ className }) {
  return <Badge cls="bg-emerald-50 text-emerald-700 ring-emerald-200" className={className}><Icon name="shield" className="h-3 w-3" />Verified</Badge>;
}

export function TrustBadge({ score }) {
  const tone = score >= 70 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : score >= 40 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-stone-100 text-stone-600 ring-stone-200';
  return <Badge cls={tone}><Icon name="award" className="h-3 w-3" />Trust {score ?? '—'}</Badge>;
}

/* ---------- people ---------- */

export function Avatar({ user, size = 'h-10 w-10', className }) {
  const src = imgSrc(user?.profileImage);
  const name = user?.organizationDetails?.orgName || user?.name;
  return src ? (
    <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover', size, className)} />
  ) : (
    <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800', size, className)}>{initials(name)}</span>
  );
}

export function UserChip({ user, to = true }) {
  const label = user?.organizationDetails?.orgName || user?.name || 'Unknown user';
  const inner = (
    <>
      <Avatar user={user} size="h-8 w-8" />
      <span className="truncate text-sm font-medium">{label}</span>
      {user?.organizationDetails?.verificationStatus === 'VERIFIED' && <Icon name="shield" className="h-4 w-4 shrink-0 text-emerald-600" title="Verified organization" />}
    </>
  );
  return to && user?._id ? <Link to={`/users/${user._id}`} className="flex min-w-0 items-center gap-2 hover:underline">{inner}</Link> : <span className="flex min-w-0 items-center gap-2">{inner}</span>;
}

export function Stars({ value = 0, size = 'h-4 w-4' }) {
  return (
    <span className="inline-flex items-center" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={cn(size, i <= Math.round(value) ? 'fill-saffron-400 text-saffron-400' : 'fill-stone-200 text-stone-200')}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

export function StarInput({ value, onChange, label = 'Rating' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          onClick={() => onChange(i)}
          className="rounded p-0.5"
        >
          <svg viewBox="0 0 24 24" className={cn('h-8 w-8 transition', i <= value ? 'fill-saffron-400 text-saffron-400' : 'fill-stone-200 text-stone-300 hover:fill-saffron-200')}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* ---------- forms ---------- */

export function Field({ label, error, hint, required, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const child = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        className: cn(children.props.className, error && 'input-error'),
      })
    : children;
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}</label>}
      {child}
      {error ? <p id={`${id}-err`} className="mt-1 text-xs text-red-600" role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

export function Button({ loading, children, className, variant = 'primary', size, ...rest }) {
  return (
    <button className={cn('btn', `btn-${variant}`, size && `btn-${size}`, className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Spinner className="h-4 w-4 text-current" />}
      {children}
    </button>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || !meta.totalPages || meta.totalPages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
      <button type="button" className="btn btn-secondary btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>← Previous</button>
      <span className="text-sm text-stone-600">Page {meta.page} of {meta.totalPages}</span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next →</button>
    </nav>
  );
}

/* ---------- dialogs ---------- */

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([type=hidden]),select,[tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children, footer, size = 'max-w-lg' }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => (ref.current?.querySelector('input,textarea,select') || ref.current?.querySelector(FOCUSABLE))?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous && previous.focus) previous.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-stone-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn('card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl sm:p-6', size)}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-stone-500 hover:bg-stone-100" aria-label="Close dialog"><Icon name="x" /></button>
        </div>
        {children}
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, text, confirmLabel = 'Confirm', danger = false, loading = false, disabled = false, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="max-w-md"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} disabled={disabled} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      {text && <p className="text-sm text-stone-600">{text}</p>}
      {children}
    </Modal>
  );
}

/** Small "ask for a note, then run" dialog used for decline / cancel / suspend flows. */
export function NoteDialog({ open, onClose, onSubmit, title, label = 'Note', required = false, confirmLabel = 'Submit', danger = false, placeholder }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setNote(''); }, [open]);
  const submit = async () => {
    setBusy(true);
    try { await onSubmit(note.trim()); } finally { setBusy(false); }
  };
  return (
    <ConfirmDialog open={open} onClose={onClose} onConfirm={submit} title={title} confirmLabel={confirmLabel} danger={danger} loading={busy} disabled={required && note.trim().length < 3}>
      <Field label={label} required={required}>
        <textarea className="input min-h-24" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder} />
      </Field>
      {required && note.trim().length < 3 && <p className="mt-1 text-xs text-stone-500">Please add a short explanation.</p>}
    </ConfirmDialog>
  );
}
