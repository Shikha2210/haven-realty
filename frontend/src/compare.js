import { useEffect, useState } from 'react';

const KEY = 'haven_compare';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (ids) => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage unavailable */ } window.dispatchEvent(new Event('compare-change')); };

/** Up to 4 property ids to compare, remembered in this browser only. */
export function useCompare() {
  const [ids, setIds] = useState(read);
  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener('compare-change', sync);
    return () => window.removeEventListener('compare-change', sync);
  }, []);
  return {
    ids,
    has: (id) => ids.includes(id),
    toggle: (id) => {
      const cur = read();
      if (cur.includes(id)) return write(cur.filter((x) => x !== id));
      if (cur.length >= 4) return false;
      write([...cur, id]);
      return true;
    },
    clear: () => write([]),
  };
}
