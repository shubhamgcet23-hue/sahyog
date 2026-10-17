import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <p className="font-display text-8xl font-bold text-brand-200">404</p>
        <h1 className="mt-2 text-3xl">We couldn’t find that page</h1>
        <p className="mx-auto mt-2 max-w-md text-stone-600">The link may be broken, or the page may have been removed. Let’s get you back to your community.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn btn-primary">Go home</Link>
          <Link to="/discover" className="btn btn-secondary">Find resources</Link>
        </div>
      </div>
    </div>
  );
}
