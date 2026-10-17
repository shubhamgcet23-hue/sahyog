import { Link } from 'react-router-dom';
import Icon from './Icon';
import { Badge, StatusBadge, TypeBadge, VerifiedBadge } from './ui';
import { CATEGORY_EMOJI, CATEGORY_NAMES, CONDITIONS, EMERGENCY_STATUS, URGENCY } from '../utils/constants';
import { fmtKm, imgSrc, isVerifiedOrg, orgName, timeAgo } from '../utils/format';

export function ResourceCard({ resource: r }) {
  const src = imgSrc(r.images?.[0]);
  return (
    <Link to={`/resources/${r._id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-300">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-brand-50 to-saffron-50">
        {src ? (
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <span className="grid h-full place-items-center text-5xl" aria-hidden="true">{CATEGORY_EMOJI[r.category] || '📦'}</span>
        )}
        <span className="absolute left-3 top-3"><TypeBadge type={r.availabilityType} /></span>
        {r.availableQuantity === 0 && <span className="absolute right-3 top-3"><Badge cls="bg-stone-800 text-white ring-stone-900">Allocated</Badge></span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-sans text-base font-semibold text-stone-900">{r.title}</h3>
        <p className="flex items-center gap-1 text-xs text-stone-500"><Icon name="pin" className="h-3.5 w-3.5" />{r.areaLabel || 'Nearby'}{r.distanceKm !== undefined && ` · ${fmtKm(r.distanceKm)}`}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-stone-600">
          <span>{CONDITIONS[r.condition]} · {r.availableQuantity} available</span>
          {r.owner && <span className="flex items-center gap-1 truncate">{isVerifiedOrg(r.owner) && <Icon name="shield" className="h-3.5 w-3.5 text-emerald-600" title="Verified organization" />}<span className="truncate">{orgName(r.owner)}</span></span>}
        </div>
      </div>
    </Link>
  );
}

export function EmergencyCard({ e }) {
  const u = URGENCY[e.urgency];
  return (
    <Link to={`/emergencies/${e._id}`} className="card flex flex-col gap-3 border-l-4 p-4 transition hover:-translate-y-0.5" style={{ borderLeftColor: u?.color }}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge cls={u?.cls}>{u?.label} urgency</Badge>
        <StatusBadge status={e.status} map={EMERGENCY_STATUS} />
        <Badge>{CATEGORY_NAMES[e.category] || e.category}</Badge>
        {isVerifiedOrg(e.creator) && <VerifiedBadge />}
      </div>
      <h3 className="line-clamp-2 font-sans text-base font-semibold text-stone-900">{e.title}</h3>
      <p className="line-clamp-2 text-sm text-stone-600">{e.description}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <span className="flex items-center gap-1"><Icon name="pin" className="h-3.5 w-3.5" />{e.areaLabel || 'Nearby'}{e.distanceKm !== undefined && ` · ${fmtKm(e.distanceKm)}`}</span>
        <span>{e.responseCount} offer{e.responseCount === 1 ? '' : 's'} · {timeAgo(e.createdAt)}</span>
      </div>
    </Link>
  );
}
