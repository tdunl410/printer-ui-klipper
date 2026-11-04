const jsonHeaders = {
  'Content-Type': 'application/json',
};

const extractMessageFromJson = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return extractMessageFromJson(record.message)
    ?? extractMessageFromJson(record.error)
    ?? extractMessageFromJson(record.description)
    ?? extractMessageFromJson(record.reason);
};

const extractMessageFromText = (value: string): string | undefined => {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('Traceback (most recent call last):'))
    .filter((line) => !line.startsWith('File "'))
    .filter((line) => !line.startsWith('During handling of the above exception'))
    .filter((line) => !line.startsWith('raise '));

  if (!lines.length) {
    return undefined;
  }

  const preferred = lines[lines.length - 1] ?? lines[0];
  const normalized = preferred.replace(/^[A-Za-z_][\w.]*:\s*/, '').trim();
  return normalized || undefined;
};

const formatRequestError = (status: number, rawBody: string) => {
  const text = rawBody.trim();
  if (!text) {
    return `Request failed (${status})`;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    const message = extractMessageFromJson(parsed);
    if (message) {
      return message;
    }
  } catch {
    // Ignore and fall through to text parsing.
  }

  return extractMessageFromText(text) ?? `Request failed (${status})`;
};

export class MoonrakerHttpClient {
  constructor(private readonly baseUrl: string) {}

  withBaseUrl(baseUrl: string) {
    return new MoonrakerHttpClient(baseUrl);
  }

  // Moonraker's HTTP query format is ?object=field1,field2 (a bare name returns all fields)
  async queryObjects(objects: Record<string, string[] | null>) {
    const params = new URLSearchParams();
    Object.entries(objects).forEach(([name, fields]) => params.append(name, fields?.join(',') ?? ''));
    const response = await fetch(`${this.baseUrl}/printer/objects/query?${params}`);
    if (!response.ok) {
      throw new Error(`Moonraker query failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async listObjects() {
    const response = await fetch(`${this.baseUrl}/printer/objects/list`);
    if (!response.ok) {
      throw new Error(`List objects failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async listFiles(root = 'gcodes') {
    const response = await fetch(`${this.baseUrl}/server/files/list?${new URLSearchParams({ root })}`);
    if (!response.ok) {
      throw new Error(`List files failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async systemInfo() {
    const response = await fetch(`${this.baseUrl}/machine/system_info`);
    if (!response.ok) {
      throw new Error(`System info failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async networkInfo() {
    const response = await fetch(`${this.baseUrl}/machine/network`);
    if (!response.ok) {
      throw new Error(`Network info failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async updateStatus() {
    const response = await fetch(`${this.baseUrl}/machine/update/status`);
    if (!response.ok) {
      throw new Error(`Update status failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async serverInfo() {
    const response = await fetch(`${this.baseUrl}/server/info`);
    if (!response.ok) {
      throw new Error(`Server info failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async historyTotals() {
    const response = await fetch(`${this.baseUrl}/server/history/totals`);
    if (!response.ok) {
      throw new Error(`History totals failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async databaseItem(namespace: string, key: string) {
    const response = await fetch(
      `${this.baseUrl}/server/database/item?${new URLSearchParams({ namespace, key })}`,
    );
    if (!response.ok) {
      throw new Error(`Database item failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async rpcCall(method: string, params: Record<string, unknown> = {}) {
    const response = await fetch(`${this.baseUrl}/printer/gcode/script`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ script: `RESPOND PREFIX=ui MSG='${method}'` }),
    });

    if (!response.ok) {
      throw new Error(`RPC fallback failed: ${response.status}`);
    }

    return { result: { method, params } };
  }

  async post(path: string, body: Record<string, unknown> = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(formatRequestError(response.status, text));
    }

    return (await response.json()) as Record<string, unknown>;
  }

  async get(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(formatRequestError(response.status, text));
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async delete(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(formatRequestError(response.status, text));
    }

    return (await response.json()) as Record<string, unknown>;
  }

  async uploadGcode(file: File, path = '') {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('root', 'gcodes');
    if (path) {
      form.append('path', path);
    }

    const response = await fetch(`${this.baseUrl}/server/files/upload`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      const message = formatRequestError(response.status, text);
      throw new Error(message || `Upload failed (${response.status})`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}
