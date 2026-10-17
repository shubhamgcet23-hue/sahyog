import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import ImagePicker from '../components/ImagePicker';
import LocationPicker from '../components/LocationPicker';
import { Button, Field, PageHeader, SafetyNotice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { api, errMsg, toFormData } from '../services/api';
import { EMERGENCY_CATEGORIES, URGENCY } from '../utils/constants';
import { coordsOf } from '../utils/format';

export default function EmergencyForm() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { location } = useLocationContext();
  const [place, setPlace] = useState(location || (user?.location ? { ...coordsOf(user.location), label: user.areaLabel } : null));
  const [files, setFiles] = useState([]);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { title: '', description: '', category: 'MEDICAL', urgency: 'MEDIUM', quantity: '', areaLabel: '', contactMethod: 'IN_APP', sharePhoneWithAccepted: false, contactNotes: '' },
  });
  const method = watch('contactMethod');
  const blocked = user.role === 'ORGANIZATION' && user.organizationDetails?.verificationStatus !== 'VERIFIED';

  const onSubmit = async (v) => {
    setServerError('');
    if (!place || !Number.isFinite(place.lat)) { setServerError('Choose the approximate area where help is needed.'); return; }
    const fields = {
      title: v.title.trim(), description: v.description.trim(), category: v.category, urgency: v.urgency, quantity: v.quantity,
      lat: place.lat, lng: place.lng, areaLabel: v.areaLabel.trim() || (place.label !== 'Pinned on map' ? place.label : ''),
      contactMethod: v.contactMethod, sharePhoneWithAccepted: v.contactMethod === 'PHONE' ? v.sharePhoneWithAccepted : false, contactNotes: v.contactNotes.trim(),
    };
    try {
      const { data } = await api.post('/emergencies', toFormData(fields, files, 'images'));
      toast.success('Your request is live. Neighbours will be notified of offers.');
      nav(`/emergencies/${data.emergency?._id || data._id}`, { replace: true });
    } catch (e) { setServerError(errMsg(e)); }
  };

  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader eyebrow="Community help" title="Request emergency assistance" subtitle="Describe what is needed. Your exact address and phone number are never shown publicly." />
      <div className="mb-6"><SafetyNotice /></div>
      {blocked && <p className="mb-6 rounded-2xl border border-saffron-200 bg-saffron-50 p-4 text-sm text-saffron-700" role="alert">Organizations must be verified before posting emergency campaigns. <Link to="/organization" className="link">Go to verification</Link></p>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-5 p-6">
        {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
        <Field label="Title" required error={errors.title?.message}><input className="input" maxLength={140} placeholder="e.g. Need an oxygen concentrator for a few days" {...register('title', { required: 'Add a short title', minLength: { value: 5, message: 'At least 5 characters' } })} /></Field>
        <Field label="What is needed?" required error={errors.description?.message} hint="Say what, how much, by when — but no bank details, OTPs or exact addresses.">
          <textarea className="input min-h-32" maxLength={3000} {...register('description', { required: 'Describe the need', minLength: { value: 10, message: 'At least 10 characters' } })} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Category" required><select className="input" {...register('category')}>{Object.entries(EMERGENCY_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Urgency" required><select className="input" {...register('urgency')}>{Object.entries(URGENCY).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}</select></Field>
          <Field label="Quantity (optional)" error={errors.quantity?.message}><input type="number" min="1" className="input" {...register('quantity', { min: { value: 1, message: 'Must be at least 1' } })} /></Field>
        </div>
        <div>
          <p className="label">Approximate area <span className="text-red-600" aria-hidden="true">*</span></p>
          <LocationPicker value={place} onChange={setPlace} />
          <Field label="Area name (shown publicly)" className="mt-3" hint="e.g. “Sector 62, Noida”"><input className="input" maxLength={120} {...register('areaLabel')} /></Field>
        </div>
        <fieldset className="space-y-3 rounded-xl border border-stone-200 p-4">
          <legend className="px-1 text-sm font-medium text-stone-700">How should helpers reach you?</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" value="IN_APP" {...register('contactMethod')} />In-app only</label>
            <label className="flex items-center gap-2"><input type="radio" value="PHONE" {...register('contactMethod')} />Phone, after I accept an offer</label>
          </div>
          {method === 'PHONE' && (
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" {...register('sharePhoneWithAccepted')} /><span>Share my phone number <strong>only</strong> with helpers whose offers I accept. {!user.phone && <Link to="/profile" className="link">Add a phone number first.</Link>}</span></label>
          )}
          <Field label="Coordination notes (optional)"><input className="input" maxLength={200} placeholder="e.g. Best after 6 pm; can collect from a hospital gate" {...register('contactNotes')} /></Field>
        </fieldset>
        <ImagePicker files={files} setFiles={setFiles} max={3} label="Supporting photos (optional)" />
        <div className="flex justify-end gap-2"><Link to="/emergencies" className="btn btn-secondary">Cancel</Link><Button type="submit" variant="danger" loading={isSubmitting} disabled={blocked}>Publish request</Button></div>
      </form>
    </div>
  );
}
