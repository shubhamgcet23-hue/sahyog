import { Link } from 'react-router-dom';
import { Logo } from './Navbar';

export default function Footer() {
  return (
    <footer className="mt-20 bg-brand-900 text-brand-100">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-3 max-w-md text-sm text-brand-200">
            Sahyog (सहयोग) means <em>cooperation</em>. We help neighbours, schools, hospitals and NGOs lend, borrow, donate and share what they already have — so less goes to waste and more reaches people who need it.
          </p>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-saffron-300">Explore</h2>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:underline" to="/discover">Discover resources</Link></li>
            <li><Link className="hover:underline" to="/emergencies">Emergency help</Link></li>
            <li><Link className="hover:underline" to="/impact">Community impact</Link></li>
            <li><Link className="hover:underline" to="/about">About Sahyog</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-saffron-300">Trust &amp; safety</h2>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:underline" to="/safety">Safety tips</Link></li>
            <li><Link className="hover:underline" to="/privacy">Privacy</Link></li>
            <li><Link className="hover:underline" to="/terms">Terms of use</Link></li>
            <li><Link className="hover:underline" to="/contact">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-800">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-brand-300 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Sahyog. A community coordination platform — not an emergency-response service. In danger, call 112.</p>
          <p>Map data © OpenStreetMap contributors</p>
        </div>
      </div>
    </footer>
  );
}
