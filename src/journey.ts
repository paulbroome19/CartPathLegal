import Constants from 'expo-constants';
import type { LatLng } from './geo';

const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
const KEY: string = typeof extra?.tflKey === 'string' && extra.tflKey ? extra.tflKey : '';
export const tflKeyPresent = KEY.length > 0;

export interface Journey {
  minutes: number;
  changes: number;
  hasBus: boolean;
  finalWalkMin: number;
}

// Modes the TfL API treats as "rail" legs (interchanges between these count as changes)
const RAIL = new Set([
  'tube', 'national-rail', 'dlr', 'overground', 'elizabeth-line', 'tram', 'river-bus',
]);

const cache = new Map<string, Journey | null>();

function cacheKey(o: LatLng, d: LatLng): string {
  return `${o.lat.toFixed(4)},${o.lng.toFixed(4)}>${d.lat.toFixed(4)},${d.lng.toFixed(4)}`;
}

// Typed shapes for TfL Journey Planner response
interface TflLeg {
  duration?: number;
  mode?: { id?: string; name?: string };
}
interface TflJourney {
  duration: number;
  legs: TflLeg[];
}
interface TflResponse {
  journeys?: TflJourney[];
}

function modeId(leg: TflLeg): string {
  return (leg.mode?.id ?? leg.mode?.name ?? '').toLowerCase();
}

export async function getJourney(o: LatLng, d: LatLng): Promise<Journey | null> {
  const k = cacheKey(o, d);
  if (cache.has(k)) return cache.get(k)!;

  const qs = KEY ? `?app_key=${KEY}` : '';
  const url = `https://api.tfl.gov.uk/Journey/JourneyResults/${o.lat},${o.lng}/to/${d.lat},${d.lng}${qs}`;

  try {
    const res = await fetch(url);
    if (!res.ok) { cache.set(k, null); return null; }

    const data = (await res.json()) as TflResponse;
    const journeys = (data.journeys ?? []).filter(
      (j): j is TflJourney => typeof j.duration === 'number',
    );
    if (!journeys.length) { cache.set(k, null); return null; }

    const best = journeys.reduce((a, b) => (b.duration < a.duration ? b : a));
    const legs = best.legs ?? [];
    const railLegs = legs.filter((l) => RAIL.has(modeId(l)));
    const last = legs[legs.length - 1];

    const out: Journey = {
      minutes: best.duration,
      changes: Math.max(0, railLegs.length - 1),
      hasBus: legs.some((l) => modeId(l) === 'bus'),
      finalWalkMin:
        legs.length > 0 && modeId(last) === 'walking'
          ? Math.round(last.duration ?? 0)
          : 0,
    };
    cache.set(k, out);
    return out;
  } catch (_e) {
    cache.set(k, null);
    return null;
  }
}

// Concurrency-limited batch fetch; calls onResult per course as each settles.
export async function getJourneysBatch(
  o: LatLng,
  items: Array<{ id: string; dest: LatLng }>,
  onResult: (id: string, j: Journey | null) => void,
  concurrency = 6,
): Promise<void> {
  let idx = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (idx < items.length) {
        const item = items[idx++];
        onResult(item.id, await getJourney(o, item.dest));
      }
    }),
  );
}
