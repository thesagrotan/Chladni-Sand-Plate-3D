import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, PRESETS, type VoidShape } from '../src/types/chladni.ts';
import { VOID_SHAPE_BY_ID, VOID_SHAPE_CATALOG } from '../src/utils/voidShapes.ts';

describe('void shape catalog', () => {
  it('offers a dropdown entry for every shape used by defaults and presets', () => {
    const used = new Set<VoidShape>([DEFAULT_PARAMS.centerVoidShape]);
    for (const preset of PRESETS) {
      if (preset.params.centerVoidShape) used.add(preset.params.centerVoidShape);
    }

    for (const shape of used) {
      expect(VOID_SHAPE_BY_ID[shape]).toBeDefined();
    }
  });

  it('keeps ids and labels unique', () => {
    const ids = VOID_SHAPE_CATALOG.map((option) => option.id);
    const labels = VOID_SHAPE_CATALOG.map((option) => option.label);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('gives every option a label and description', () => {
    for (const option of VOID_SHAPE_CATALOG) {
      expect(option.label.trim()).not.toBe('');
      expect(option.description?.trim()).not.toBe('');
    }
  });
});
