import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Async, Badge, Button, ConfirmDialog, Field, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg } from '../services/api';
import { REPORT_REASONS } from '../utils/constants';
import { fmtDate, fmtDateTime } from '../utils/format';
import { passwordRules } from './Register';

function Section({ title, text, children }) {
  return (
    <section className="card p-6">
      <h2 className="text-xl">{title}</h2>
      {text && <p className="mt-1 text-sm text-stone-600">{text}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PasswordForm() {
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({ defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const onSubmit = async ({ currentPassword, newPassword }) => {
    setServerError('');
    try { await api.patch('/auth/change-password', { currentPassword, newPassword }); toast.success('Password changed. Other devices were signed out.'); reset(); } catch (e) { setServerError(errMsg(e)); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md space-y-4">
      {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
      <Field label="Current password" error={errors.currentPassword?.message}><input type="password" autoComplete="current-password" className="input" {...register('currentPassword', { required: 'Enter your current password' })} /></Field>
      <Field label="New password" error={errors.newPassword?.message} hint="At least 8 characters, with a letter and a number."><input type="password" autoComplete="new-password" className="input" {...register('newPassword', passwordRules)} /></Field>
      <Field label="Confirm new password" error={errors.confirm?.message}><input type="password" autoComplete="new-password" className="input" {...register('confirm', { required: 'Confirm your new password', validate: (v) => v === watch('newPassword') || 'Passwords do not match' })} /></Field>
      <Button type="submit" loading={isSubmitting}>Change password</Button>
    </form>
  );
}

function Moderation({ highlight }) {
  const state = useFetch(() => api.get('/users/me/moderations'), []);
  const [appealing, setAppealing] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await api.post(`/reports/${appealing._id}/appeal`, { text: text.trim() }); toast.success('Appeal submitted. An administrator will review it.'); setAppealing(null); setText(''); state.reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Async state={state} empty={<p className="text-sm text-stone-500">No moderation decisions have been made on your account or content. 🎉</p>}>
      {(items) => (
        <>
          <ul className="space-y-3">
            {items.map((m) => (
              <li key={m._id} className={`rounded-xl border p-4 text-sm ${highlight === m._id ? 'border-brand-400 bg-brand-50' : 'border-stone-200'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{m.targetType.toLowerCase()} · {REPORT_REASONS[m.reason] || m.reason}</span>
                  <span className="flex items-center gap-2">{m.adminDecision?.action && m.adminDecision.action !== 'NONE' && <Badge cls="bg-red-100 text-red-800 ring-red-200">{m.adminDecision.action.replace('_', ' ').toLowerCase()}</Badge>}{m.appeal?.status && <Badge cls="bg-sky-100 text-sky-800 ring-sky-200">appeal {m.appeal.status.toLowerCase()}</Badge>}</span>
                </div>
                {m.adminDecision?.note && <p className="mt-1 text-stone-600">Note: {m.adminDecision.note}</p>}
                <p className="mt-1 text-xs text-stone-400">{fmtDate(m.createdAt)}</p>
                {m.appeal?.note && <p className="mt-1 text-stone-600">Administrator’s response: {m.appeal.note}</p>}
                {m.adminDecision?.violationConfirmed && !m.appeal?.status && <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => setAppealing(m)}>Challenge this decision</button>}
              </li>
            ))}
          </ul>
          <ConfirmDialog open={!!appealing} onClose={() => setAppealing(null)} onConfirm={submit} loading={busy} disabled={text.trim().length < 10} confirmLabel="Submit appeal" title="Challenge this decision" text="Explain why you believe the decision was a mistake. An administrator will review it; you can appeal once.">
            <textarea className="input mt-3 min-h-28" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Appeal explanation" placeholder="At least 10 characters" />
          </ConfirmDialog>
        </>
      )}
    </Async>
  );
}

export default function Settings() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const rewards = useFetch(() => api.get('/users/me/rewards'), []);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const signOutAll = async () => {
    setBusy(true);
    try { await api.post('/auth/logout-all'); setUser(null); toast.success('Signed out everywhere'); nav('/login'); } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  return (
    <div className="container-page max-w-3xl space-y-6 py-8">
      <PageHeader eyebrow="Account" title="Settings & account" />
      <Section title="Account">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-stone-500">Name</dt><dd className="font-medium">{user.name}</dd></div>
          <div><dt className="text-stone-500">Email</dt><dd className="font-medium">{user.email}</dd></div>
          <div><dt className="text-stone-500">Account type</dt><dd className="font-medium">{user.role.charAt(0) + user.role.slice(1).toLowerCase()}</dd></div>
          <div><dt className="text-stone-500">Member since</dt><dd className="font-medium">{fmtDate(user.createdAt)}</dd></div>
        </dl>
        <Link to="/profile" className="btn btn-secondary btn-sm mt-4">Edit profile</Link>
      </Section>
      <Section title="Change password" text="Changing your password signs you out on every other device."><PasswordForm /></Section>
      <Section title="Sessions" text="If you used Sahyog on a shared device, you can end every session at once.">
        <button type="button" className="btn btn-secondary" onClick={() => setConfirm(true)}>Sign out of all devices</button>
        <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={signOutAll} loading={busy} title="Sign out everywhere?" text="You’ll need to sign in again on this device too." confirmLabel="Sign out everywhere" danger />
      </Section>
      <Section title="Moderation & appeals" text="Decisions that affect your content or account appear here. You can challenge a decision once."><Moderation highlight={sp.get('appeal')} /></Section>
      <Section title="Reward points ledger" text="Points are earned once per verified exchange and can be reversed if fraud is found. They have no cash value.">
        <Async state={rewards} empty={<p className="text-sm text-stone-500">Complete an exchange to earn your first points.</p>}>
          {(items) => <ul className="divide-y divide-stone-100 text-sm">{items.map((t) => <li key={t._id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0"><span className="block truncate">{t.description}</span><span className="text-xs text-stone-400">{fmtDateTime(t.createdAt)}</span></span><span className={t.points < 0 ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'}>{t.points > 0 ? '+' : ''}{t.points}</span></li>)}</ul>}
        </Async>
      </Section>
      <p className="text-xs text-stone-500">Read our <Link to="/privacy" className="link">privacy</Link>, <Link to="/terms" className="link">terms</Link> and <Link to="/safety" className="link">safety</Link> pages. To request data deletion, use the <Link to="/contact" className="link">contact page</Link>.</p>
    </div>
  );
}
