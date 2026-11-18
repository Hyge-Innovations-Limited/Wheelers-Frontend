/**
 * Where the Studio's dataset comes from. Today: the seeded sample (lib/studio/sample.ts), built once in the browser.
 * When the server endpoint exists it returns the same StudioDataset (lib/studio/schema.ts) and only this file changes.
 */
import { useMemo } from "react";
import { sampleDataset } from "./sample";
import type { StudioDataset } from "./schema";

export function useStudioDataset(): StudioDataset {
  return useMemo(() => sampleDataset(), []);
}
