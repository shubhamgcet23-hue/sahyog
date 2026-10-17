import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import LocationPicker from '../components/LocationPicker';
import { Async, Avatar, Button, EmptyState, Field, PageHeader, StatCard, Stars, TrustBadge, VerifiedBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg } from '../services/api';
import { ORG_TYPES } from '../utils/constants';
import { coordsOf, fmtDate, fmtNumber, imgSrc } from '../utils/format';

const phoneRule = { pattern: { value: /^[+\d][\d\s-]{6,17}$/, message: 'Enter a valid phone number' } };

export default function Profile() {
  const { user, setUser } = useAuth();
  const isOrg = user.role === 'ORGANIZATION';
  const [place, setPlace] = useState(user.location ? { ...coordsOf(user.location), label: user.areaLabel || 'Saved area' } : null);
  const [avatar, setAvatar] = useState(null);
  const [serverError, setServerError] = useState('');
  const reviews = useFetch(() => api.get(`/users/${user._id}/reviews`, { limit: 5 }), [user._id]);
  const od = user.organizationDetails || {};
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm({
    defaultValues: { name: user.name, phone: user.phone || '', bio: user.bio || '', areaLabel: user.areaLabel || '', orgName: od.orgName || '', website: od.website || '', orgDescription: od.description || '' },
  });

  const onSubmit = async (v) => {
    setServerError('');
    const fd = new FormData();
    fd.append('name', v.name.trim());
    if (v.phone.trim()) fd.append('phone', v.phone.trim());
    fd.append('bio', v.bio.trim());
    if (v.areaLabel.trim()) fd.append('areaLabel', v.areaLabel.trim());
    if (place && Number.isFinite(place.lat)) { fd.append('lat', place.lat); fd.append('lng', place.lng); }
    if (isOrg) { fd.append('orgName', v.orgName.trim()); if (v.website.trim()) fd.append('website', v.website.trim()); if (v.orgDescription.trim()) fd.append('orgDescription', v.orgDescription.trim()); }
    if (avatar) fd.append('profileImage', avatar);
    try {
      const { data } = await api.patch('/users/me', fd);
      setUser(data.user);
      setAvatar(null);
      toast.success('Profile updated');
    } catch (e) { setServerError(errMsg(e)); }
  };

  const preview = avatar ? URL.createObjectURL(avatar) : null;

  return (
    <div className="container-page max-w-5xl py-8">
      <PageHeader eyebrow="Account" title="Your profile" subtitle="This is what other members see. Your email and exact location are never shown." actions={<Link to={`/users/${user._id}`} className="btn btn-secondary btn-sm"><Icon name="eye" className="h-4 w-4" />View public profile</Link>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-5 p-6 lg:col-span-2">
          {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
          <div className="flex items-center gap-4">
            {preview ? <img src={preview} alt="" className="h-20 w-20 rounded-full object-cover" /> : <Avatar user={user} size="h-20 w-20 text-xl" />}
            <div>
              <label className="btn btn-secondary btn-sm cursor-pointer">
                <Icon name="image" className="h-4 w-4" />Change photo
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files[0]; if (f && f.size > 5 * 1024 * 1024) toast.error('Image must be under 5 MB'); else if (f) setAvatar(f); }} />
              </label>
              <p className="mt-1 text-xs text-stone-500">JPG, PNG or WebP, up to 5 MB</p>
            </div>
          </div>
          <Field label="Full name" required error={errors.name?.message}><input className="input" {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email" hint="Cannot be changed here."><input className="input" value={user.email} disabled readOnly /></Field>
            <Field label="Phone" hint="Shared only after a request is approved." error={errors.phone?.message}><input type="tel" className="input" {...register('phone', phoneRule)} /></Field>
          </div>
          <Field label="About you" hint="A line or two so neighbours know who you are." error={errors.bio?.message}><textarea className="input min-h-20" maxLength={400} {...register('bio')} /></Field>
          {isOrg && (
            <fieldset className="space-y-4 rounded-xl border border-stone-200 p-4">
              <legend className="px-1 text-sm font-medium text-stone-700">Organization ({ORG_TYPES[od.orgType] || 'not set'})</legend>
              <Field label="Organization name" required error={errors.orgName?.message}><input className="input" {...register('orgName', { required: 'Organization name is required' })} /></Field>
              <Field label="Website"><input type="url" className="input" placeholder="https://" {...register('website')} /></Field>
              <Field label="About the organization"><textarea className="input min-h-20" maxLength={1000} {...register('orgDescription')} /></Field>
              <p className="text-xs text-stone-500">Verification status is set by administrators — <Link to="/organization" className="link">manage verification</Link>.</p>
            </fieldset>
          )}
          <div>
            <p className="label">Home area (used as your default search location)</p>
            <LocationPicker value={place} onChange={setPlace} />
            <Field label="Area name" className="mt-3"><input className="input" maxLength={120} placeholder="e.g. Pari Chowk, Greater Noida" {...register('areaLabel')} /></Field>
          </div>
          <div className="flex justify-end"><Button type="submit" loading={isSubmitting} disabled={!isDirty && !avatar && place?.label === user.areaLabel}>Save changes</Button></div>
        </form>

        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <StatCard icon="award" label="Trust score" value={user.trustScore} hint="Calculated from your activity" />
            <StatCard icon="star" tone="saffron" label="Reward points" value={fmtNumber(user.rewardPoints)} />
            <StatCard icon="check" tone="sky" label="Completed exchanges" value={user.completedExchanges || 0} />
          </div>
          <section className="card p-5">
            <h2 className="mb-3 font-sans text-base font-semibold">Reviews about you</h2>
            <Async state={reviews} empty={<p className="text-sm text-stone-500">No reviews yet. Complete an exchange to get your first one.</p>}>
              {(items) => (
                <ul className="space-y-3">
                  {items.map((r) => (
                    <li key={r._id} className="text-sm"><div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-stone-400">{fmtDate(r.createdAt)}</span></div>
                      {r.comment && <p className="mt-1 text-stone-700">“{r.comment}”</p>}<p className="text-xs text-stone-500">— {r.reviewer?.name}</p></li>
                  ))}
                </ul>
              )}
            </Async>
          </section>
          <div className="flex flex-wrap gap-2"><TrustBadge score={user.trustScore} />{isOrg && od.verificationStatus === 'VERIFIED' && <VerifiedBadge />}</div>
          {imgSrc(user.profileImage) === null && <EmptyState icon="user" title="Add a photo" text="Profiles with a photo get more responses." />}
        </aside>
      </div>
    </div>
  );
}
