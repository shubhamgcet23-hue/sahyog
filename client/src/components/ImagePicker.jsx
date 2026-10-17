import { useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import Icon from './Icon';
import { imgSrc } from '../utils/format';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Controlled image chooser.
 *  files / setFiles  — newly selected File objects
 *  existing          — images already stored on the server ([{ url }])
 *  removed / setRemoved — urls of existing images the user wants to delete
 */
export default function ImagePicker({ files, setFiles, existing = [], removed = [], setRemoved, max = 5, label = 'Photos' }) {
  const input = useRef(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const keptExisting = existing.filter((i) => !removed.includes(i.url));
  const total = keptExisting.length + files.length;

  const onPick = (e) => {
    const picked = [...e.target.files];
    e.target.value = '';
    const ok = [];
    for (const f of picked) {
      if (!TYPES.includes(f.type)) { toast.error(`"${f.name}" is not a JPG, PNG or WebP image`); continue; }
      if (f.size > MAX_BYTES) { toast.error(`"${f.name}" is larger than 5 MB`); continue; }
      ok.push(f);
    }
    const room = max - total;
    if (ok.length > room) toast.error(`You can add up to ${max} photos`);
    setFiles([...files, ...ok.slice(0, Math.max(room, 0))]);
  };

  return (
    <div>
      <p className="label">{label} <span className="font-normal text-stone-500">({total}/{max})</span></p>
      <ul className="flex flex-wrap gap-3">
        {keptExisting.map((img) => (
          <li key={img.url} className="relative h-24 w-24 overflow-hidden rounded-xl border border-stone-200">
            <img src={imgSrc(img)} alt="" className="h-full w-full object-cover" />
            {setRemoved && <button type="button" onClick={() => setRemoved([...removed, img.url])} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 shadow" aria-label="Remove photo"><Icon name="x" className="h-3.5 w-3.5" /></button>}
          </li>
        ))}
        {previews.map((src, i) => (
          <li key={src} className="relative h-24 w-24 overflow-hidden rounded-xl border border-stone-200">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 shadow" aria-label="Remove photo"><Icon name="x" className="h-3.5 w-3.5" /></button>
          </li>
        ))}
        {total < max && (
          <li>
            <button type="button" onClick={() => input.current?.click()} className="grid h-24 w-24 place-items-center rounded-xl border-2 border-dashed border-stone-300 text-stone-500 transition hover:border-brand-400 hover:text-brand-700">
              <span className="flex flex-col items-center gap-1 text-xs"><Icon name="image" />Add photo</span>
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept={TYPES.join(',')} multiple className="sr-only" onChange={onPick} tabIndex={-1} aria-label={`Choose ${label.toLowerCase()}`} />
      <p className="mt-1.5 text-xs text-stone-500">JPG, PNG or WebP · up to 5 MB each</p>
    </div>
  );
}
