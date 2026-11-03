import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Building2, ClipboardCheck, FileText, Heart, Home, KeyRound, LayoutDashboard, LogOut, Menu, MessageSquare,
  MessagesSquare, ScrollText, Search, ShieldCheck, Store, UserCircle, Users, X, BarChart3, Scale, Handshake, GitCompare,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import api from '../api.js';
import { fmtDateTime } from './ui.jsx';
import { useCompare } from '../compare.js';

export function Logo({ light }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Haven Realty home">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-500 text-white"><Building2 size={20} /></span>
      <span className={`font-display text-xl font-semibold ${light ? 'text-white' : 'text-navy-900'}`}>Haven <span className="text-gold-500">Realty</span></span>
    </Link>
  );
}

/** Where a signed-in person lands. */
export const homeFor = (u) => (u?.role === 'AGENT' ? '/agent' : '/account');

/* ------------------------------------------------------------------ public */
export function PublicLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { ids } = useCompare();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const link = ({ isActive }) => `text-sm font-semibold ${isActive ? 'text-gold-600' : 'text-navy-900 hover:text-gold-600'}`;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex">
            <NavLink to="/properties" className={() => `text-sm font-semibold ${loc.pathname.startsWith('/properties') && !loc.search.includes('category=RENT') ? 'text-gold-600' : 'text-navy-900 hover:text-gold-600'}`}>Buy &amp; Rent</NavLink>
            <NavLink to="/properties?category=RENT" className={() => `text-sm font-semibold ${loc.pathname === '/properties' && loc.search.includes('category=RENT') ? 'text-gold-600' : 'text-navy-900 hover:text-gold-600'}`}>Rentals</NavLink>
            <NavLink to="/compare" className={link}>Compare{ids.length > 0 && <span className="ml-1 rounded-full bg-gold-100 px-1.5 text-xs text-gold-600">{ids.length}</span>}</NavLink>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                <Link to={homeFor(user)} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">My portal</Link>
                <button onClick={logout} className="text-sm font-semibold text-muted hover:text-navy-900">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-navy-900 hover:text-gold-600">Sign in</Link>
                <Link to="/signup" className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">Create account</Link>
              </>
            )}
          </div>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <div className="flex flex-col gap-3 border-t border-line bg-white px-4 py-4 md:hidden">
            <Link to="/properties" className="font-semibold">Buy &amp; Rent</Link>
            <Link to="/compare" className="font-semibold">Compare</Link>
            {user ? <><Link to={homeFor(user)} className="font-semibold">My portal</Link><button onClick={logout} className="text-left font-semibold text-muted">Sign out</button></>
              : <><Link to="/login" className="font-semibold">Sign in</Link><Link to="/signup" className="font-semibold text-gold-600">Create account</Link></>}
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="bg-navy-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div><Logo light /><p className="mt-3 max-w-xs text-sm text-slate-400">Considered homes across Chandigarh, Mohali and Panchkula — every enquiry handled personally by our agent.</p></div>
          <div className="text-sm"><p className="mb-2 font-semibold text-white">Explore</p><ul className="space-y-1.5"><li><Link to="/properties">Browse properties</Link></li><li><Link to="/properties?category=RENT">Rentals</Link></li><li><Link to="/signup">Sell with us</Link></li></ul></div>
          <div className="text-sm"><p className="mb-2 font-semibold text-white">Staff</p><ul className="space-y-1.5"><li><Link to="/login?portal=agent">Agent sign in</Link></li></ul></div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} Haven Realty. Sample imagery is illustrative.</div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ portals */
const nav = {
  buyer: [
    ['/account', 'Dashboard', LayoutDashboard, true], ['/properties', 'Browse', Search], ['/account/wishlist', 'Wishlist', Heart],
    ['/account/enquiries', 'My enquiries', MessageSquare], ['/account/seller-application', 'Become a seller', Store], ['/account/profile', 'Profile', UserCircle],
  ],
  seller: [
    ['/seller', 'Dashboard', LayoutDashboard, true], ['/seller/properties', 'My properties', Home], ['/seller/properties/new', 'Add property', KeyRound],
    ['/seller/messages', 'Agent messages', MessagesSquare], ['/account/profile', 'Profile', UserCircle],
  ],
  agent: [
    ['/agent', 'Dashboard', BarChart3, true], ['/agent/enquiries', 'Enquiries', MessageSquare], ['/agent/properties', 'Properties', Home],
    ['/agent/verifications', 'Seller verification', ShieldCheck], ['/agent/customers', 'Customers', Users], ['/agent/sales', 'Sales', Handshake],
    ['/agent/rentals', 'Rentals', Scale], ['/agent/audit', 'Audit log', ScrollText],
  ],
};

function Bell_() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const nav = useNavigate();
  const ref = useRef();
  const load = () => api.get('/account/notifications').then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const go = (n) => {
    api.post(`/account/notifications/${n.id}/read`).then(load);
    setOpen(false);
    if (n.link) nav(n.link.startsWith('/enquiries') ? `/account${n.link}` : n.link);
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(!open); load(); }} className="relative rounded-full p-2 text-navy-900 hover:bg-navy-50" aria-label={`Notifications, ${data.unread} unread`}>
        <Bell size={20} />
        {data.unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-white">{data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            <button className="text-xs font-semibold text-gold-600" onClick={() => api.post('/account/notifications/read-all').then(load)}>Mark all read</button>
          </div>
          <ul className="max-h-96 overflow-auto">
            {data.items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">You’re all caught up.</li>}
            {data.items.map((n) => (
              <li key={n.id}>
                <button onClick={() => go(n)} className={`block w-full border-b border-line px-4 py-3 text-left hover:bg-navy-50 ${n.read ? '' : 'bg-gold-100/40'}`}>
                  <p className="text-sm font-semibold text-navy-900">{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">{fmtDateTime(n.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PortalLayout({ mode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const items = nav[mode];
  const switchTo = mode === 'seller' ? ['/account', 'Switch to buyer', Home] : user?.sellerEnabled ? ['/seller', 'Switch to seller', Store] : null;
  const SideLink = ({ to, text, Icon, end }) => (
    <NavLink to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
      <Icon size={18} />{text}
    </NavLink>
  );
  const sidebar = (
    <div className="flex h-full flex-col bg-navy-900 p-4">
      <div className="mb-6 px-1"><Logo light /></div>
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gold-500">{mode === 'agent' ? 'Agent console' : mode === 'seller' ? 'Seller portal' : 'My account'}</p>
      <nav className="flex-1 space-y-1">{items.map(([to, text, Icon, end]) => <SideLink key={to} to={to} text={text} Icon={Icon} end={end} />)}
        {switchTo && <div className="pt-3"><SideLink to={switchTo[0]} text={switchTo[1]} Icon={switchTo[2]} /></div>}
      </nav>
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="mb-3 px-1"><p className="truncate text-sm font-semibold text-white">{user?.fullName}</p><p className="truncate text-xs text-slate-400">{user?.email}</p></div>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5"><LogOut size={18} />Sign out</button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block"><div className="sticky top-0 h-screen">{sidebar}</div></aside>
      {open && <div className="fixed inset-0 z-50 flex lg:hidden"><div className="w-72">{sidebar}</div><div className="flex-1 bg-black/50" onClick={() => setOpen(false)} /></div>}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <Link to="/properties" className="hidden items-center gap-2 text-sm font-semibold text-muted hover:text-navy-900 lg:flex"><Search size={16} />Browse listings</Link>
          <div className="flex items-center gap-1"><Bell_ /></div>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
