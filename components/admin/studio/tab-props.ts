import type { Filtered, Level, StudioFilters } from "@/lib/studio/filters";
import type { StudioDataset, StudioSession } from "@/lib/studio/schema";

/** What every Studio tab gets: the whole dataset, what the filters keep, and the cross-filter. */
export interface TabProps {
  data: StudioDataset;
  f: Filtered;
  filters: StudioFilters;
  /** A chart click: toggles that pick on the whole page (offer / ping picks narrow their own charts only). */
  pick: (key: string, value: string, level?: Level) => void;
  /** The value picked for a key, to show it selected on its chart. */
  sel: (key: string) => string | null;
  byId: Map<string, StudioSession>;
  /** What the filters keep without the pick on `key`: for the chart that pick is made on. */
  fx: (key: string) => Filtered;
  /** A field the data does not record yet (live data): its charts say so. */
  nr: (field: string) => boolean;
}
