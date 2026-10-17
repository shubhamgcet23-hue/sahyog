import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { Avatar } from './ui';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { cn } from '../utils/constants';

export function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill={light ? '#faf8f3' : '#1b574a'} />
        <path d="M9 17c0-4 3-7 7-7s7 3 7 7-3 7-7 7" fill="none" stroke="#f7a325" strokeWidth="3" strokeLinecap="round" />
        <path d="M23 15c0 4-3 7-7 7s-7-3-7-7" fill="none" stroke={light ? '#1b574a' : '#faf8f3'} strokeWidth="3" strokeLinecap="round" opacity=".92" />
      </svg>
      <span className={cn('font-display text-xl font-bold tracking-tight', light ? 'text-white' : 'text-brand-900')}>Sahyog</span>
    </span>
  );
}

const linkCls = ({ isActive }) => cn('rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-100 text-brand-800' : 'text-stone-700 hover:bg-stone-200/60');

export default function Navbar() {
  const { user, logout } = useAuth();
  const { unread } = useSocket();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => { setOpen(false); setMenu(false); }, [loc.pathname]);
  useEffect(() => {
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const signOut = async () => { await logout(); nav('/'); };
  const isAdmin = user?.role === 'ADMIN';

  const links = (
    <>
      <NavLink to="/discover" className={linkCls}>Discover</NavLink>
      <NavLink to="/emergencies" className={linkCls}>Emergency help</NavLink>
      <NavLink to="/impact" className={linkCls}>Impact</NavLink>
      <NavLink to="/about" className={linkCls}>About</NavLink>
    </>
  );

  return (
    <header className="sticky top-0 z-[900] border-b border-stone-200/80 bg-paper/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link to="/" aria-label="Sahyog home"><Logo /></Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">{links}</nav>

        <div className="flex items-center gap-1.5">
          {user ? (
            <>
              {!isAdmin && <Link to="/resources/new" className="btn btn-accent btn-sm hidden sm:inline-flex"><Icon name="plus" className="h-4 w-4" />Share</Link>}
              <Link to="/messages" className="rounded-lg p-2 text-stone-700 hover:bg-stone-200/60" aria-label="Messages"><Icon name="message" /></Link>
              <Link to="/notifications" className="relative rounded-lg p-2 text-stone-700 hover:bg-stone-200/60" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
                <Icon name="bell" />
                {unread > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <div className="relative" ref={menuRef}>
                <button type="button" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} className="flex items-center gap-1 rounded-full p-0.5 pr-1.5 hover:bg-stone-200/60">
                  <Avatar user={user} size="h-8 w-8" /><Icon name="chevron" className="h-4 w-4 text-stone-500" />
                </button>
                {menu && (
                  <div role="menu" className="card absolute right-0 mt-2 w-60 overflow-hidden p-1.5 text-sm">
                    <div className="border-b border-stone-100 px-3 py-2">
                      <p className="truncate font-semibold text-stone-900">{user.organizationDetails?.orgName || user.name}</p>
                      <p className="truncate text-xs text-stone-500">{user.email}</p>
                    </div>
                    {isAdmin ? (
                      <MenuLink to="/admin" icon="shield">Admin dashboard</MenuLink>
                    ) : (
                      <>
                        <MenuLink to="/dashboard" icon="home">Dashboard</MenuLink>
                        <MenuLink to="/my-listings" icon="box">My listings</MenuLink>
                        <MenuLink to="/requests" icon="repeat">My requests</MenuLink>
                        {user.role === 'ORGANIZATION' && <MenuLink to="/organization" icon="building">Organization</MenuLink>}
                      </>
                    )}
                    <MenuLink to="/profile" icon="user">Profile</MenuLink>
                    <MenuLink to="/settings" icon="settings">Settings</MenuLink>
                    <button type="button" role="menuitem" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-700 hover:bg-red-50"><Icon name="logout" className="h-4 w-4" />Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Join Sahyog</Link>
            </>
          )}
          <button type="button" className="rounded-lg p-2 text-stone-700 hover:bg-stone-200/60 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Toggle menu"><Icon name={open ? 'x' : 'menu'} /></button>
        </div>
      </div>
      {open && (
        <nav className="container-page flex flex-col gap-1 border-t border-stone-200 pb-3 pt-2 md:hidden" aria-label="Mobile">
          {links}
          {user && !isAdmin && <NavLink to="/resources/new" className={linkCls}>Share a resource</NavLink>}
        </nav>
      )}
    </header>
  );
}

function MenuLink({ to, icon, children }) {
  return <Link to={to} role="menuitem" className="flex items-center gap-2 rounded-lg px-3 py-2 text-stone-700 hover:bg-brand-50"><Icon name={icon} className="h-4 w-4 text-brand-600" />{children}</Link>;
}
