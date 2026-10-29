export function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function hhmmFromSeconds(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  return `${h}:${m}`;
}
