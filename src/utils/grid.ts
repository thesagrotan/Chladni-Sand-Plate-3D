import type { ChladniParams, GridType, VoidShape } from '../types/chladni.ts';

export interface GridCatalogEntry {
  type: GridType;
  label: string;
  shortLabel: string;
  desc: string;
}

export const GRID_CATALOG: GridCatalogEntry[] = [
  {
    type: 'annular',
    label: 'Annular Halo',
    shortLabel: 'Annular',
    desc: 'Circuits around center with radial ribs',
  },
  {
    type: 'rectangular',
    label: 'Courtyard Lattice',
    shortLabel: 'Courtyard',
    desc: 'Orthogonal grid with empty central zone',
  },
  {
    type: 'polar',
    label: 'Polar Orbitals',
    shortLabel: 'Polar',
    desc: 'Concentric wave rings & rays around core',
  },
  {
    type: 'hexagonal',
    label: 'Hex Honeycomb',
    shortLabel: 'Hexagon',
    desc: 'Triaxial 60° interference honeycomb',
  },
  {
    type: 'diamond',
    label: 'Diamond Cage',
    shortLabel: 'Diamond',
    desc: '45° rotated diagonal rhombus mesh',
  },
  {
    type: 'web',
    label: 'Spiderweb',
    shortLabel: 'Spiderweb',
    desc: 'Concentric web looping around center',
  },
];

export const GRID_CATALOG_BY_TYPE = Object.fromEntries(
  GRID_CATALOG.map((entry) => [entry.type, entry])
) as Record<GridType, GridCatalogEntry>;

/**
 * Produces a randomized grid/void/resonance patch. Both the G shortcut and
 * the ControlPanel Random button use this to keep their behavior identical.
 */
export function randomizeGridParams(): Partial<ChladniParams> {
  const nextType = GRID_CATALOG[Math.floor(Math.random() * GRID_CATALOG.length)].type;
  const randomRadius = +(0.2 + Math.random() * 0.22).toFixed(2);
  const nextShape: VoidShape =
    nextType === 'rectangular' || nextType === 'diamond'
      ? Math.random() > 0.4
        ? 'square'
        : 'circle'
      : 'circle';

  return {
    gridType: nextType,
    centerVoidRadius: randomRadius,
    centerVoidShape: nextShape,
    centerExpulsion: +(2.2 + Math.random() * 1.4).toFixed(1),
    modeM: +(3.0 + Math.floor(Math.random() * 7) * 0.5).toFixed(2),
    modeN: +(4.0 + Math.floor(Math.random() * 8) * 0.5).toFixed(2),
    waveK: +(28.0 + Math.random() * 10.0).toFixed(1),
    symmetryBlend: +(0.55 + Math.random() * 0.4).toFixed(2),
  };
}
