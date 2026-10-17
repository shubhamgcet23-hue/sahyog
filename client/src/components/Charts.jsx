import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Palette validated for colour-blind separation and 3:1 contrast on the light surface.
export const SERIES = { DONATE: '#d4690a', BORROW: '#0284c7', SHARE: '#1a9a5b' };
export const SERIES_LABEL = { DONATE: 'Donations', BORROW: 'Borrows', SHARE: 'Shares' };
const AXIS = { fontSize: 12, fill: '#57534e' };

const shortLabel = (l) => (l.length === 7 ? new Date(`${l}-01T00:00:00Z`).toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }) : l.slice(5).replace('-', '/'));

export function ActivityChart({ timeline }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={timeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#e7e5e4" vertical={false} />
        <XAxis dataKey="label" tickFormatter={shortLabel} tick={AXIS} tickLine={false} axisLine={{ stroke: '#d6d3d1' }} minTickGap={16} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip labelFormatter={shortLabel} formatter={(v, k) => [v, SERIES_LABEL[k] || k]} cursor={{ fill: 'rgba(0,0,0,.04)' }} />
        <Legend formatter={(k) => <span className="text-stone-700">{SERIES_LABEL[k] || k}</span>} />
        {Object.keys(SERIES).map((k) => <Bar key={k} dataKey={k} stackId="a" fill={SERIES[k]} stroke="#fff" strokeWidth={1} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleLine({ data, dataKey, name, color = '#0284c7' }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#e7e5e4" vertical={false} />
        <XAxis dataKey="label" tickFormatter={shortLabel} tick={AXIS} tickLine={false} axisLine={{ stroke: '#d6d3d1' }} minTickGap={16} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip labelFormatter={shortLabel} formatter={(v) => [v, name]} />
        <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 3, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HBar({ data, dataKey = 'value', nameKey = 'name', color = '#1a9a5b', height }) {
  return (
    <ResponsiveContainer width="100%" height={height || Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#e7e5e4" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey={nameKey} width={150} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,.04)' }} />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Accessible table alternative to a chart. */
export function DataTable({ rows, columns, caption }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">{columns.map((c) => <th key={c.key} scope="col" className="px-2 py-1.5">{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-stone-100">{columns.map((c) => <td key={c.key} className="px-2 py-1.5">{r[c.key]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
