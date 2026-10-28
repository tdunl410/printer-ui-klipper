export function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function celsius(current: number, target?: number) {
  if (typeof target === 'number') {
    return `${Math.round(current)} / ${Math.round(target)}°C`;
  }
  return `${Math.round(current)}°C`;
}

export function hhmmFromSeconds(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  return `${h}:${m}`;
}
