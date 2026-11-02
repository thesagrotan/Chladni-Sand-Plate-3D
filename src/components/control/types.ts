import type { ChladniParams } from '../../types/chladni.ts';

export type UpdateParam = <K extends keyof ChladniParams>(
  key: K,
  val: ChladniParams[K]
) => void;

export type UpdateParams = (updates: Partial<ChladniParams>) => void;
