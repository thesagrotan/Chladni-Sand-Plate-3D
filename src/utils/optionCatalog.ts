import type { LucideIcon } from 'lucide-react';

/** One selectable entry in a panel dropdown. */
export interface CatalogOption<T extends string> {
  id: T;
  label: string;
  /** One line shown under the label while the dropdown is open. */
  description?: string;
  icon?: LucideIcon;
}

/**
 * Turns a catalog array into an id → entry lookup, so code that already has a
 * value can resolve its label/icon without scanning the list.
 *
 * Adding another dropdown-backed setting:
 *  1. Add the value union to `ChladniParams` in `src/types/chladni.ts`.
 *  2. Export a `CatalogOption<Union>[]` catalog next to its domain helpers
 *     (see `src/utils/voidShapes.ts` for the shape to copy).
 *  3. Render it with `<OptionSelect options={catalog} … />` from
 *     `src/components/control/OptionSelect.tsx`.
 */
export function indexCatalog<T extends string>(
  options: readonly CatalogOption<T>[]
): Record<T, CatalogOption<T>> {
  return Object.fromEntries(options.map((option) => [option.id, option])) as Record<
    T,
    CatalogOption<T>
  >;
}
