import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import ImagePicker from '../components/ImagePicker';
import LocationPicker from '../components/LocationPicker';
import Icon from '../components/Icon';
import { Async, Button, Field, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { useCategories, useFetch } from '../hooks/useFetch';
import { api, errMsg, toFormData } from '../services/api';
import { CONDITIONS, FALLBACK_CATEGORIES, TYPE_META, cn } from '../utils/constants';
import { coordsOf, toInputDate } from '../utils/format';

const blank = { title: '', description: '', category: '', subcategory: '', condition: 'GOOD', availabilityType: 'BORROW', quantity: 1, availableFrom: '', availableTo: '', areaLabel: '', addressDetail: '' };

/** Create (/resources/new) and edit (/resources/:id/edit) share this form. */
export default function ResourceForm() {
  const { id } = useParams();
  const editing = !!id;
  const existing = useFetch(() => api.get(`/resources/${id}`), [id], { enabled: editing });
  return editing ? (
    <Async state={existing}>{(r) => <Form resource={r} />}</Async>
  ) : <Form />;
}

function Form({ resource }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const { location } = useLocationContext();
  const categories = useCategories() || FALLBACK_CATEGORIES;
  const editing = !!resource;
  const initialPlace = resource ? { ...coordsOf(resource.location), label: resource.areaLabel } : location || (user?.location ? { ...coordsOf(user.location), label: user.areaLabel } : null);
  const [place, setPlace] = useState(initialPlace);
  const [files, setFiles] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: resource ? {
      ...blank, title: resource.title, description: resource.description, category: resource.category, subcategory: resource.subcategory || '', condition: resource.condition,
      availabilityType: resource.availabilityType, quantity: resource.quantity, availableFrom: toInputDate(resource.availabilityDates?.from), availableTo: toInputDate(resource.availabilityDates?.to),
      areaLabel: resource.areaLabel || '', addressDetail: resource.addressDetail || '',
    } : { ...blank, areaLabel: initialPlace?.label && initialPlace.label !== 'My current location' ? initialPlace.label : '' },
  });
  const type = watch('availabilityType');
  const category = watch('category');
  const subs = categories.find((c) => c.slug === category)?.subcategories || [];
  const from = watch('availableFrom');

  useEffect(() => { if (!editing && !category && categories[0] && categories !== FALLBACK_CATEGORIES) setValue('category', categories[0].slug); }, [categories, category, editing, setValue]);

  const onSubmit = async (v) => {
    setServerError('');
    if (!place || !Number.isFinite(place.lat)) { setServerError('Choose where this item is (approximate area) using the map or “Use my location”.'); return; }
    const fields = {
      title: v.title.trim(), description: v.description.trim(), category: v.category, subcategory: v.subcategory, condition: v.condition, availabilityType: v.availabilityType,
      quantity: v.quantity, lat: place.lat, lng: place.lng, areaLabel: v.areaLabel.trim() || (place.label !== 'Pinned on map' ? place.label : ''), addressDetail: v.addressDetail.trim(),
      availableFrom: v.availableFrom, availableTo: v.availableTo,
    };
    if (editing && removed.length) fields.removeImages = removed;
    try {
      const body = toFormData(fields, files);
      const { data } = editing ? await api.patch(`/resources/${resource._id}`, body) : await api.post('/resources', body);
      toast.success(editing ? 'Listing updated' : 'Your resource is live!');
      nav(`/resources/${data._id}`);
    } catch (e) {
      setServerError(errMsg(e));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader eyebrow={editing ? 'Edit listing' : 'Share a resource'} title={editing ? resource.title : 'What would you like to share?'} subtitle="Listings are always free. Describe the item honestly and pick how you’d like to share it." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
        {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}

        <section className="card space-y-5 p-5 sm:p-6">
          <fieldset>
            <legend className="label">How will you share it?</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(TYPE_META).map(([k, m]) => (
                <label key={k} className={cn('flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500', type === k ? 'border-brand-500 bg-brand-50' : 'border-stone-300 bg-white hover:border-brand-300')}>
                  <input type="radio" value={k} className="sr-only" {...register('availabilityType')} />
                  <span className="flex items-center gap-2 font-semibold"><Icon name={m.icon} className="h-4 w-4 text-brand-600" />{m.label}</span>
                  <span className="text-xs text-stone-600">{m.blurb}</span>
                </label>
              ))}
            </div>
            {editing && <p className="mt-2 text-xs text-stone-500">The type can’t change while requests are open.</p>}
          </fieldset>

          <Field label="Title" required error={errors.title?.message}>
            <input className="input" maxLength={120} placeholder="e.g. Bosch cordless drill with 2 batteries" {...register('title', { required: 'Title is required', minLength: { value: 3, message: 'At least 3 characters' }, maxLength: { value: 120, message: 'At most 120 characters' } })} />
          </Field>
          <Field label="Description" required error={errors.description?.message} hint="Size, brand, what’s included, any defects, and how it should be used or returned.">
            <textarea className="input min-h-32" maxLength={3000} {...register('description', { required: 'Description is required', minLength: { value: 10, message: 'Please write at least 10 characters' } })} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" required error={errors.category?.message}>
              <select className="input" {...register('category', { required: 'Choose a category', onChange: () => setValue('subcategory', '') })}>
                <option value="">Select…</option>
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Subcategory" error={errors.subcategory?.message}>
              <select className="input" disabled={!subs.length} {...register('subcategory')}>
                <option value="">{subs.length ? 'Optional' : '—'}</option>
                {subs.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Condition" required error={errors.condition?.message}>
              <select className="input" {...register('condition', { required: true })}>{Object.entries(CONDITIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
            <Field label="Quantity" required error={errors.quantity?.message}>
              <input type="number" min="1" max="10000" className="input" {...register('quantity', { required: 'Enter a quantity', valueAsNumber: true, min: { value: 1, message: 'At least 1' }, max: { value: 10000, message: 'At most 10,000' }, validate: (v) => Number.isInteger(v) || 'Whole numbers only' })} />
            </Field>
            <Field label="Available from" error={errors.availableFrom?.message}><input type="date" className="input" {...register('availableFrom')} /></Field>
            <Field label="Available until" error={errors.availableTo?.message}><input type="date" min={from || undefined} className="input" {...register('availableTo', { validate: (v) => !v || !from || v >= from || 'End date must be after the start date' })} /></Field>
          </div>
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="text-xl">Photos</h2>
          <ImagePicker files={files} setFiles={setFiles} existing={resource?.images || []} removed={removed} setRemoved={setRemoved} max={5} />
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="text-xl">Where is it?</h2>
          <LocationPicker value={place} onChange={setPlace} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Area name" hint="Shown publicly, e.g. “Alpha 1, Greater Noida”. Not your street address." error={errors.areaLabel?.message}>
              <input className="input" maxLength={120} {...register('areaLabel')} />
            </Field>
            <Field label="Private pickup details" hint="Only the approved requester sees this (gate, landmark, timings)." error={errors.addressDetail?.message}>
              <input className="input" maxLength={300} {...register('addressDetail')} />
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3">
          <Link to={editing ? `/resources/${resource._id}` : '/my-listings'} className="btn btn-secondary">Cancel</Link>
          <Button type="submit" loading={isSubmitting} className="btn-lg">{editing ? 'Save changes' : 'Publish listing'}</Button>
        </div>
      </form>
    </div>
  );
}
