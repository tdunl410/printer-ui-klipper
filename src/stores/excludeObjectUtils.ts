import type { ExcludeObjectItem, ExcludeObjectsState } from '../domain/models';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizePolygon = (value: unknown): [number, number][] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((point): [number, number][] => {
    if (!Array.isArray(point) || point.length < 2) return [];
    const [x, y] = point;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [[x, y]];
  });
};

const normalizeObject = (value: unknown): Omit<ExcludeObjectItem, 'isExcluded'> | undefined => {
  if (!isRecord(value) || typeof value.name !== 'string') return undefined;
  const name = value.name.trim();
  if (!name) return undefined;
  return { name, polygon: normalizePolygon(value.polygon) };
};

export const parseExcludeObjects = (
  payload: unknown,
  fallback: ExcludeObjectsState,
): ExcludeObjectsState => {
  if (!isRecord(payload)) return fallback;

  const previousByName = new Map(fallback.objects.map((item) => [item.name, item]));
  const hasExcludedList = Array.isArray(payload.excluded_objects);
  const rawExcludedNames: unknown[] = hasExcludedList ? payload.excluded_objects as unknown[] : [];
  const excludedNames = new Set(
    hasExcludedList
      ? rawExcludedNames
        .filter((name): name is string => typeof name === 'string')
        .map((name) => name.trim())
        .filter(Boolean)
      : [],
  );

  const incomingObjects = Array.isArray(payload.objects)
    ? payload.objects.map(normalizeObject).filter((item): item is Omit<ExcludeObjectItem, 'isExcluded'> => Boolean(item))
    : undefined;
  // Klipper can send partial status updates, and may briefly publish an empty or
  // truncated list while a print is starting. Merge valid definitions by name.
  const definitionsByName = new Map(
    fallback.objects.map(({ isExcluded: _isExcluded, ...item }) => [item.name, item]),
  );
  incomingObjects?.forEach((item) => definitionsByName.set(item.name, item));
  const objects = Array.from(definitionsByName.values()).map((item) => ({
    ...item,
    isExcluded: hasExcludedList
      ? excludedNames.has(item.name)
      : previousByName.get(item.name)?.isExcluded ?? false,
  }));

  const currentObject = typeof payload.current_object === 'string'
    ? payload.current_object.trim() || undefined
    : payload.current_object === null
      ? undefined
      : fallback.currentObject;

  return { objects, currentObject };
};