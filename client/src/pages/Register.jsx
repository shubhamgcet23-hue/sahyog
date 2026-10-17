import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api, errMsg } from '../services/api';
import { Button, Field } from '../components/ui';
import LocationPicker from '../components/LocationPicker';
import { AuthShell, emailRule } from './Login';
import { ORG_TYPES, cn } from '../utils/constants';

export const passwordRules = {
  required: 'Password is required',
  minLength: { value: 8, message: 'Password must be at least 8 characters' },
  maxLength: { value: 72, message: 'Password is too long' },
  validate: (v) => (/[A-Za-z]/.test(v) && /\d/.test(v)) || 'Use at least one letter and one number',
};

export default function Register() {
  const { register: signUp } = useAuth();
  const nav = useNavigate();
  const [serverError, setServerError] = useState('');
  const [place, setPlace] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ defaultValues: { role: 'USER', name: '', email: '', phone: '', password: '', confirm: '', orgName: '', orgType: '' } });
  const role = watch('role');

  const onSubmit = async (v) => {
    setServerError('');
    const body = { name: v.name.trim(), email: v.email.trim(), password: v.password, role: v.role };
    if (v.phone.trim()) body.phone = v.phone.trim();
    if (v.role === 'ORGANIZATION') body.organizationDetails = { orgName: v.orgName.trim(), orgType: v.orgType };
    try {
      await signUp(body);
      // The register endpoint only takes account details; the optional home area is saved right after sign-up.
      if (place && Number.isFinite(place.lat)) {
        const areaLabel = place.label && !['Pinned on map', 'Custom location', 'My current location'].includes(place.label) ? place.label : undefined;
        await api.patch('/users/me', { lat: place.lat, lng: place.lng, areaLabel }).catch(() => {});
      }
      toast.success('Welcome to Sahyog!');
      nav(v.role === 'ORGANIZATION' ? '/organization' : '/dashboard', { replace: true });
    } catch (e) {
      setServerError(errMsg(e));
    }
  };

  return (
    <AuthShell title="Join your community" subtitle="Free to join. Share what you can, ask for what you need." footer={<>Already have an account? <Link to="/login" className="link">Sign in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}

        <fieldset>
          <legend className="label">I'm joining as</legend>
          <div className="grid grid-cols-2 gap-2">
            {[['USER', 'An individual'], ['ORGANIZATION', 'An organization']].map(([val, label]) => (
              <label key={val} className={cn('cursor-pointer rounded-xl border p-3 text-center text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500', role === val ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-stone-300 bg-white text-stone-700')}>
                <input type="radio" value={val} className="sr-only" {...register('role')} />{label}
              </label>
            ))}
          </div>
          {role === 'ORGANIZATION' && <p className="mt-2 text-xs text-stone-500">Hospitals, schools, NGOs and community groups can apply for admin verification after signing up.</p>}
        </fieldset>

        <Field label={role === 'ORGANIZATION' ? 'Contact person name' : 'Full name'} error={errors.name?.message}>
          <input autoComplete="name" className="input" {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Name must be at least 2 characters' }, maxLength: { value: 80, message: 'Name is too long' } })} />
        </Field>

        {role === 'ORGANIZATION' && (
          <>
            <Field label="Organization name" error={errors.orgName?.message}>
              <input className="input" {...register('orgName', { validate: (v) => role !== 'ORGANIZATION' || v.trim().length > 1 || 'Organization name is required' })} />
            </Field>
            <Field label="Organization type" error={errors.orgType?.message}>
              <select className="input" {...register('orgType', { validate: (v) => role !== 'ORGANIZATION' || !!v || 'Select an organization type' })}>
                <option value="">Select…</option>
                {Object.entries(ORG_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
          </>
        )}

        <Field label="Email" error={errors.email?.message}>
          <input type="email" autoComplete="email" className="input" {...register('email', emailRule)} />
        </Field>
        <Field label="Phone (optional)" error={errors.phone?.message} hint="Only shared with someone whose request you approve.">
          <input type="tel" autoComplete="tel" className="input" {...register('phone', { pattern: { value: /^$|^[+\d][\d\s-]{6,17}$/, message: 'Enter a valid phone number' } })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" error={errors.password?.message} hint="8+ characters, with a letter and a number.">
            <input type="password" autoComplete="new-password" className="input" {...register('password', passwordRules)} />
          </Field>
          <Field label="Confirm password" error={errors.confirm?.message}>
            <input type="password" autoComplete="new-password" className="input" {...register('confirm', { required: 'Confirm your password', validate: (v) => v === watch('password') || 'Passwords do not match' })} />
          </Field>
        </div>

        <div>
          <button type="button" className="link text-sm" onClick={() => setShowMap((s) => !s)} aria-expanded={showMap}>{showMap ? 'Hide' : 'Set'} my area (optional, helps you find nearby resources)</button>
          {showMap && <div className="mt-3"><LocationPicker value={place} onChange={setPlace} height="h-44" /></div>}
        </div>

        <p className="text-xs text-stone-500">By creating an account you agree to our <Link to="/terms" className="link">Terms</Link> and <Link to="/privacy" className="link">Privacy policy</Link>.</p>
        <Button type="submit" loading={isSubmitting} className="w-full">Create account</Button>
      </form>
    </AuthShell>
  );
}
