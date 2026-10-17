import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api, errMsg } from '../services/api';
import { Button, Field } from '../components/ui';
import { AuthShell, emailRule } from './Login';
import { passwordRules } from './Register';

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: { email: '' } });
  const onSubmit = async ({ email }) => {
    setServerError('');
    try { await api.post('/auth/forgot-password', { email: email.trim() }); setSent(true); } catch (e) { setServerError(errMsg(e)); }
  };
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link that works for one hour." footer={<Link to="/login" className="link">Back to sign in</Link>}>
      {sent ? (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">If that email is registered, a reset link is on its way. Check your inbox (and spam folder).</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
          <Field label="Email" error={errors.email?.message}><input type="email" className="input" {...register('email', emailRule)} /></Field>
          <Button type="submit" loading={isSubmitting} className="w-full">Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ defaultValues: { password: '', confirm: '' } });
  const onSubmit = async ({ password }) => {
    setServerError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Password updated. Please sign in.');
      nav('/login', { replace: true });
    } catch (e) { setServerError(errMsg(e)); }
  };
  return (
    <AuthShell title="Choose a new password" footer={<Link to="/login" className="link">Back to sign in</Link>}>
      {!token ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">This reset link is incomplete. Request a new one from the “Forgot password” page.</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
          <Field label="New password" error={errors.password?.message}><input type="password" autoComplete="new-password" className="input" {...register('password', passwordRules)} /></Field>
          <Field label="Confirm new password" error={errors.confirm?.message}><input type="password" autoComplete="new-password" className="input" {...register('confirm', { required: 'Confirm your password', validate: (v) => v === watch('password') || 'Passwords do not match' })} /></Field>
          <Button type="submit" loading={isSubmitting} className="w-full">Update password</Button>
        </form>
      )}
    </AuthShell>
  );
}
