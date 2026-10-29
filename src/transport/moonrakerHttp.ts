const jsonHeaders = {
  'Content-Type': 'application/json',
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
      throw new Error(text || `Request failed (${response.status})`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  async get(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed (${response.status})`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async delete(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed (${response.status})`);
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
      throw new Error(text || `Upload failed (${response.status})`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}
