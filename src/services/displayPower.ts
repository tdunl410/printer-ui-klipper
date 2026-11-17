export async function setHostDisplayPower(action: 'on' | 'off'): Promise<boolean> {
  const response = await fetch('/api/ui/display-power', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });
  const payload = (await response.json()) as { available?: boolean; error?: string; reason?: string };

  if (!response.ok) {
    throw new Error(payload.error || `Display power request failed (${response.status})`);
  }

  return payload.available === true;
}
