import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Async, Button, Field, PageHeader, TypeBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg } from '../services/api';
import { CATEGORY_EMOJI, INTENDED_USE, TYPE_META, cn } from '../utils/constants';
import { imgSrc, tomorrowInput } from '../utils/format';

const TITLES = { BORROW: 'Request to borrow', DONATE: 'Request this donation', SHARE: 'Request to share' };

export default function RequestForm() {
  const { id } = useParams();
  const state = useFetch(() => api.get(`/resources/${id}`), [id]);
  return <Async state={state}>{(r) => <Form resource={r} />}</Async>;
}

function Form({ resource: r }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [serverError, setServerError] = useState('');
  const isBorrow = r.availabilityType === 'BORROW';
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ defaultValues: { quantity: 1, message: '', intendedUse: 'PERSONAL', handoverMethod: 'PICKUP', handoverNote: '', proposedReturnDate: '' } });
  const method = watch('handoverMethod');

  if (String(r.owner?._id) === String(user?._id)) return <Navigate to={`/resources/${r._id}`} replace />;
  if (r.viewerRequest && ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(r.viewerRequest.status)) return <Navigate to={`/requests/${r.viewerRequest._id}`} replace />;

  const onSubmit = async (v) => {
    setServerError('');
    try {
      const { data } = await api.post('/requests', {
        resourceId: r._id, quantity: v.quantity, message: v.message.trim() || undefined, intendedUse: v.intendedUse, handoverMethod: v.handoverMethod,
        handoverNote: v.handoverNote.trim() || undefined, proposedReturnDate: isBorrow && v.proposedReturnDate ? new Date(`${v.proposedReturnDate}T18:00:00`).toISOString() : undefined,
      });
      toast.success('Request sent! The owner has been notified.');
      nav(`/requests/${data._id}`);
    } catch (e) {
      setServerError(errMsg(e));
    }
  };

  const src = imgSrc(r.images?.[0]);
  return (
    <div className="container-page max-w-2xl py-8">
      <PageHeader eyebrow="Request" title={TITLES[r.availabilityType]} />
      <Link to={`/resources/${r._id}`} className="card mb-6 flex items-center gap-4 p-3 hover:border-brand-300">
        {src ? <img src={src} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-xl bg-brand-50 text-3xl" aria-hidden="true">{CATEGORY_EMOJI[r.category] || '📦'}</span>}
        <div className="min-w-0"><p className="truncate font-semibold">{r.title}</p><p className="text-sm text-stone-600">{r.availableQuantity} available · {r.areaLabel}</p><TypeBadge type={r.availabilityType} /></div>
      </Link>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-5 p-5 sm:p-6">
        {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quantity" required error={errors.quantity?.message} hint={`Up to ${r.availableQuantity}`}>
            <input type="number" min="1" max={r.availableQuantity} className="input" {...register('quantity', { valueAsNumber: true, required: 'Enter a quantity', min: { value: 1, message: 'At least 1' }, max: { value: r.availableQuantity, message: `Only ${r.availableQuantity} available` }, validate: (v) => Number.isInteger(v) || 'Whole numbers only' })} />
          </Field>
          <Field label="What will you use it for?" error={errors.intendedUse?.message}>
            <select className="input" {...register('intendedUse')}>{Object.entries(INTENDED_USE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
        </div>

        {isBorrow && (
          <Field label="Proposed return date" required error={errors.proposedReturnDate?.message} hint="The owner confirms the return. Overdue items are flagged for both of you.">
            <input type="date" min={tomorrowInput()} className="input sm:max-w-xs" {...register('proposedReturnDate', { required: 'Choose when you will return it', validate: (v) => v >= tomorrowInput() || 'Return date must be in the future' })} />
          </Field>
        )}

        <Field label="Message to the owner" error={errors.message?.message} hint="Introduce yourself and explain your need.">
          <textarea className="input min-h-28" maxLength={1000} {...register('message', { maxLength: { value: 1000, message: 'Too long' } })} />
        </Field>

        <fieldset>
          <legend className="label">Pickup or delivery?</legend>
          <div className="grid grid-cols-2 gap-3">
            {[['PICKUP', 'I’ll pick it up'], ['DELIVERY', 'Please deliver']].map(([k, l]) => (
              <label key={k} className={cn('cursor-pointer rounded-xl border p-3 text-center text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500', method === k ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-stone-300 bg-white')}>
                <input type="radio" value={k} className="sr-only" {...register('handoverMethod')} />{l}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Preferred time / place (optional)" error={errors.handoverNote?.message}><input className="input" maxLength={300} placeholder="e.g. Weekday evenings near the market" {...register('handoverNote')} /></Field>

        <p className="rounded-xl bg-brand-50 p-3 text-xs text-brand-900">{TYPE_META[r.availabilityType].blurb} Contact details and exact pickup information are shared only after the owner approves.</p>
        <div className="flex justify-end gap-3">
          <Link to={`/resources/${r._id}`} className="btn btn-secondary">Cancel</Link>
          <Button type="submit" loading={isSubmitting}>Send request</Button>
        </div>
      </form>
    </div>
  );
}
