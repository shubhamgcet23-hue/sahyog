import { NavLink, Outlet } from 'react-router-dom';
import Icon from '../components/Icon';
import { cn } from '../utils/constants';

const items = [
  { to: '/admin', end: true, icon: 'chart', label: 'Overview' },
  { to: '/admin/users', icon: 'users', label: 'Users' },
  { to: '/admin/organizations', icon: 'building', label: 'Organizations' },
  { to: '/admin/moderation', icon: 'flag', label: 'Moderation' },
];

export default function AdminLayout() {
  return (
    <div className="container-page py-8">
      <div className="mb-6 flex items-center gap-2 text-brand-800"><Icon name="shield" /><span className="eyebrow !text-brand-700">Administration</span></div>
      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-brand-900 p-1.5" aria-label="Admin">
        {items.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            className={({ isActive }) => cn('flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition', isActive ? 'bg-saffron-400 text-brand-900' : 'text-brand-100 hover:bg-brand-800')}
          >
            <Icon name={i.icon} className="h-4 w-4" />{i.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
