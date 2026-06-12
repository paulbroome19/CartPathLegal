import type { StationMode } from './types';

// bus is not a station mode but is needed by Results for journey-leg icons
export type TransportMode = StationMode | 'bus';

/** Colour keyed by transport mode. Single glyph ("train") for every mode. */
export const MODE_META: Record<TransportMode, string> = {
  rail:       '#1A1A1A', // black
  tube:       '#C8362B', // red
  overground: '#E08214', // orange
  elizabeth:  '#6B4FA0', // purple
  dlr:        '#1C8C8C', // teal
  tram:       '#2E7D43', // green
  bus:        '#1F6F8B', // blue — Results only, not a station mode
};

/** Canonical left-to-right display order for multi-mode station badges */
export const MODE_ORDER: StationMode[] = [
  'rail', 'elizabeth', 'tube', 'overground', 'dlr', 'tram',
];
