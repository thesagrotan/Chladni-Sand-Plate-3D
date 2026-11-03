import { Circle, Square } from 'lucide-react';
import type { VoidShape } from '../types/chladni.ts';
import { indexCatalog, type CatalogOption } from './optionCatalog.ts';

/**
 * Void shapes offered in the panel's "Empty Center Void" dropdown.
 *
 * To add a shape: extend `VoidShape` in `src/types/chladni.ts`, teach
 * `voidShapeToNumber` plus the GLSL/WASM void metrics the new id, then add one
 * entry here — the dropdown picks it up with no component changes.
 */
export const VOID_SHAPE_CATALOG: CatalogOption<VoidShape>[] = [
  {
    id: 'circle',
    label: 'Circle',
    description: 'Radial void — rings and ribs bend around the centre',
    icon: Circle,
  },
  {
    id: 'square',
    label: 'Square',
    description: 'Square void — edges follow the lattice axes',
    icon: Square,
  },
];

export const VOID_SHAPE_BY_ID = indexCatalog(VOID_SHAPE_CATALOG);
