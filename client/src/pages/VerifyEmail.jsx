import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errMsg } from '../services/api';
import { Spinner } from '../components/ui';
import { AuthShell } from './Login';

/** Landing page for the link in the "verify your email" message. */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState(token ? { status: 'loading' } : { status: 'error', message: 'This verification link is incomplete.' });

  useEffect(() => {
    if (!token) return;
    api.post('/auth/verify-email', { token })
      .then(() => setState({ status: 'done' }))
      .catch((e) => setState({ status: 'error', message: errMsg(e) }));
  }, [token]);

  return (
    <AuthShell title="Email verification" footer={<Link to="/" className="link">Back to home</Link>}>
      {state.status === 'loading' && <p className="flex items-center gap-2 text-sm text-stone-600"><Spinner className="h-4 w-4" />Verifying…</p>}
      {state.status === 'done' && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">Your email is verified. Thank you!</p>}
      {state.status === 'error' && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{state.message}</p>}
    </AuthShell>
  );
}
