import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../services/api';
import { Button, Field } from '../components/ui';
import { Logo } from '../components/Navbar';

export const emailRule = { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' } };

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl">{title}</h1>
          {subtitle && <p className="mb-5 mt-1 text-sm text-stone-600">{subtitle}</p>}
          {children}
        </div>
        {footer && <p className="mt-4 text-center text-sm text-stone-600">{footer}</p>}
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: { email: '', password: '' } });

  const onSubmit = async ({ email, password }) => {
    setServerError('');
    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      nav(location.state?.from || (user.role === 'ADMIN' ? '/admin' : '/dashboard'), { replace: true });
    } catch (e) {
      setServerError(errMsg(e));
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your listings, requests and messages." footer={<>New to Sahyog? <Link to="/register" className="link">Create an account</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
        <Field label="Email" error={errors.email?.message}>
          <input type="email" autoComplete="email" className="input" {...register('email', emailRule)} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input type="password" autoComplete="current-password" className="input" {...register('password', { required: 'Password is required' })} />
        </Field>
        <div className="text-right"><Link to="/forgot-password" className="link text-sm">Forgot password?</Link></div>
        <Button type="submit" loading={isSubmitting} className="w-full">Sign in</Button>
      </form>
    </AuthShell>
  );
}
