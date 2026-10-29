const encodePath = (path: string) => path.split('/').map((segment) => encodeURIComponent(segment)).join('/');

const dirname = (path: string) => {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(0, index + 1) : '';
};

export async function fetchThumbnailUrl(baseUrl: string, filePath: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${baseUrl}/server/files/metadata?${new URLSearchParams({ filename: filePath })}`);
    if (!response.ok) return undefined;

    const payload = (await response.json()) as { result?: { thumbnails?: Array<{ relative_path?: string; width?: number }> } };
    const thumbs = payload.result?.thumbnails ?? [];
    const preferred = thumbs.slice().sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))[0];
    if (!preferred?.relative_path) return undefined;

    return `${baseUrl}/server/files/gcodes/${encodePath(`${dirname(filePath)}${preferred.relative_path}`)}`;
  } catch {
    return undefined;
  }
}
