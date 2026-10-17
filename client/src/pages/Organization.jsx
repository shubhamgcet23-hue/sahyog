import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import ImagePicker from '../components/ImagePicker';
import { Async, Badge, Button, Field, PageHeader, StatCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api, errMsg, toFormData } from '../services/api';
import { ORG_TYPES } from '../utils/constants';
import { fmtDate, fmtDateTime, fmtNumber, imgSrc } from '../utils/format';

const STATUS = {
  NONE: { label: 'Not verified', cls: 'bg-stone-100 text-stone-700 ring-stone-200' },
  PENDING: { label: 'Under review', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
  VERIFIED: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  REJECTED: { label: 'Not approved', cls: 'bg-red-100 text-red-800 ring-red-200' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
};

export default function Organization() {
  const { user, refresh } = useAuth();
  const state = useFetch(() => api.get('/organizations/verification'), []);
  const activity = useFetch(() => api.get('/users/me/activity'), []);
  return (
    <div className="container-page max-w-4xl py-8">
      <PageHeader eyebrow="Organization" title={user.organizationDetails?.orgName || 'Your organization'} subtitle="Verification lets you publish emergency campaigns and shows a trust badge on your listings." />
      <Async state={state}>
        {({ details, applications }) => {
          const status = details?.verificationStatus || 'NONE';
          const canApply = ['NONE', 'REJECTED'].includes(status);
          const last = applications[0];
          return (
            <div className="space-y-6">
              <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-sm text-stone-500">Verification status</p>
                  <p className="mt-1 flex items-center gap-2 text-xl font-semibold"><Badge cls={STATUS[status].cls}>{STATUS[status].label}</Badge></p>
                  {status === 'VERIFIED' && details.verifiedAt && <p className="mt-1 text-sm text-stone-600">Verified on {fmtDate(details.verifiedAt)}</p>}
                  {status === 'REJECTED' && last?.reviewNote && <p className="mt-2 max-w-xl rounded-xl bg-red-50 p-3 text-sm text-red-800"><strong>Administrator’s note:</strong> {last.reviewNote}</p>}
                  {status === 'PENDING' && <p className="mt-1 text-sm text-stone-600">Submitted {fmtDateTime(last?.createdAt)}. You’ll get a notification when an administrator decides.</p>}
                </div>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <dt className="text-stone-500">Type</dt><dd className="font-medium">{ORG_TYPES[details?.orgType] || '—'}</dd>
                  <dt className="text-stone-500">Registration no.</dt><dd className="font-medium">{details?.registrationNumber || '—'}</dd>
                </dl>
              </section>

              {activity.data?.organization && (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard icon="box" label="Units in inventory" value={fmtNumber(activity.data.organization.inventory.unitsAvailable)} />
                  <StatCard icon="gift" tone="saffron" label="Donations received" value={activity.data.organization.donationsReceived.count} />
                  <StatCard icon="users" label="Distributed" value={activity.data.organization.resourcesDistributed.count} />
                  <StatCard icon="alert" tone="red" label="Campaigns" value={activity.data.organization.campaignsCreated} />
                </div>
              )}

              {status === 'VERIFIED' && (
                <section className="card flex flex-wrap items-center justify-between gap-3 border-emerald-200 bg-emerald-50 p-5">
                  <p className="flex items-center gap-2 text-emerald-900"><Icon name="shield" className="h-5 w-5" />You can now publish emergency campaigns.</p>
                  <Link to="/emergencies/new" className="btn btn-danger btn-sm">Start a campaign</Link>
                </section>
              )}

              {canApply && <ApplyForm defaults={details} onDone={() => { state.reload(); refresh(); }} resubmit={status === 'REJECTED'} />}

              {applications.length > 0 && (
                <section className="card p-5">
                  <h2 className="mb-3 text-lg">Application history</h2>
                  <ul className="divide-y divide-stone-100 text-sm">
                    {applications.map((a) => (
                      <li key={a._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span><strong>{a.orgName}</strong> · {ORG_TYPES[a.orgType]} · submitted {fmtDate(a.createdAt)}</span>
                        <span className="flex items-center gap-2"><Badge cls={STATUS[a.status].cls}>{STATUS[a.status].label}</Badge>{a.documents?.map((d, i) => <a key={d.url} className="link text-xs" href={imgSrc(d)} target="_blank" rel="noreferrer">Document {i + 1}</a>)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          );
        }}
      </Async>
    </div>
  );
}

function ApplyForm({ defaults, onDone, resubmit }) {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { orgName: defaults?.orgName || user.organizationDetails?.orgName || '', orgType: defaults?.orgType || 'NGO', registrationNumber: defaults?.registrationNumber || '', website: defaults?.website || '', description: defaults?.description || '', contactPerson: user.name },
  });
  const onSubmit = async (v) => {
    setServerError('');
    try {
      await api.post('/organizations/verification', toFormData(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x])), files, 'images'));
      toast.success('Application submitted for review');
      onDone();
    } catch (e) { setServerError(errMsg(e)); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-5 p-6">
      <div><h2 className="text-xl">{resubmit ? 'Apply again' : 'Apply for verification'}</h2><p className="mt-1 text-sm text-stone-600">An administrator checks the details below. Attach a registration certificate or an official letter (photo or scan).</p></div>
      {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Organization name" required error={errors.orgName?.message}><input className="input" {...register('orgName', { required: 'Required', minLength: { value: 2, message: 'At least 2 characters' } })} /></Field>
        <Field label="Type" required><select className="input" {...register('orgType')}>{Object.entries(ORG_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Registration / licence number" required error={errors.registrationNumber?.message}><input className="input" {...register('registrationNumber', { required: 'Required', minLength: { value: 3, message: 'At least 3 characters' } })} /></Field>
        <Field label="Contact person"><input className="input" {...register('contactPerson')} /></Field>
        <Field label="Website" className="sm:col-span-2"><input type="url" className="input" placeholder="https://" {...register('website')} /></Field>
      </div>
      <Field label="What does your organization do?"><textarea className="input min-h-24" maxLength={1000} {...register('description')} /></Field>
      <ImagePicker files={files} setFiles={setFiles} max={3} label="Supporting documents (photos or scans)" />
      <div className="flex justify-end"><Button type="submit" loading={isSubmitting}>Submit application</Button></div>
    </form>
  );
}
