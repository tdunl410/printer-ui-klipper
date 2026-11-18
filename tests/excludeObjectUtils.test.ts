import { describe, expect, it } from 'vitest';
import { parseExcludeObjects } from '../src/stores/excludeObjectUtils';
import type { ExcludeObjectsState } from '../src/domain/models';

const existingObjects: ExcludeObjectsState = {
  objects: [
    { name: 'part-a', polygon: [[0, 0], [10, 0], [10, 10]], isExcluded: false },
    { name: 'part-b', polygon: [[20, 20], [30, 20], [30, 30]], isExcluded: true },
  ],
  currentObject: 'part-a',
};

describe('parseExcludeObjects', () => {
  it('keeps the previous object list when an update is empty or partial', () => {
    expect(parseExcludeObjects({ objects: [], excluded_objects: [] }, existingObjects)).toEqual({
      objects: existingObjects.objects.map((item) => ({ ...item, isExcluded: false })),
      currentObject: 'part-a',
    });
    expect(parseExcludeObjects({ current_object: 'part-b' }, existingObjects)).toEqual({
      ...existingObjects,
      currentObject: 'part-b',
    });
    expect(parseExcludeObjects(undefined, existingObjects)).toBe(existingObjects);
  });

  it('filters malformed entries and coordinates without coercing input', () => {
    expect(parseExcludeObjects({
      objects: [
        null,
        { name: 7, polygon: [[1, 2]] },
        { name: '  ', polygon: [] },
        { name: ' valid ', polygon: [[1, 2], ['3', 4], [5, Infinity], [6, 7]] },
      ],
    }, { objects: [] })).toEqual({
      objects: [{ name: 'valid', polygon: [[1, 2], [6, 7]], isExcluded: false }],
      currentObject: undefined,
    });
  });

  it('applies excluded names while preserving object data from partial updates', () => {
    expect(parseExcludeObjects({ excluded_objects: [' part-a ', null] }, existingObjects)).toEqual({
      objects: [
        { ...existingObjects.objects[0], isExcluded: true },
        { ...existingObjects.objects[1], isExcluded: false },
      ],
      currentObject: 'part-a',
    });
  });

  it('merges a truncated object list without dropping other valid definitions', () => {
    expect(parseExcludeObjects({
      objects: [{ name: 'part-a', polygon: [[1, 1], [11, 1], [11, 11]] }],
    }, existingObjects)).toEqual({
      objects: [
        { name: 'part-a', polygon: [[1, 1], [11, 1], [11, 11]], isExcluded: false },
        existingObjects.objects[1],
      ],
      currentObject: 'part-a',
    });
  });

  it('replaces definitions with a valid new object list', () => {
    expect(parseExcludeObjects({
      objects: [{ name: 'new-part', polygon: [[4, 5], [6, 7]] }],
      excluded_objects: [],
      current_object: null,
    }, { objects: [] })).toEqual({
      objects: [{ name: 'new-part', polygon: [[4, 5], [6, 7]], isExcluded: false }],
      currentObject: undefined,
    });
  });
});