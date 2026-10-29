export function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function hhmmFromSeconds(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  return `${h}:${m}`;
}

export function durationLabel(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

export function filamentLabel(mm: number) {
  return mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm)} mm`;
}
