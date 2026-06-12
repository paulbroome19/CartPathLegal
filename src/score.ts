import { haversineKm } from './geo';
import type { LatLng } from './geo';
import type { Journey } from './journey';
import type { Station } from './types';

// Pre-computed geography of a course relative to its nearest transit station.
export interface CourseGeo {
  nearestStation: Station; // full Station so callers can display its name
  /** Walk time in minutes from nearest station to course (~4 km/h with golf bag) */
  walkMin: number;
  /** True when nearest station is >1.5 km away — assume bus connection needed */
  isBus: boolean;
}

// Build a CourseGeo from a course and its nearest station (found at call site).
export function makeCourseGeo(
  courseLatLng: LatLng,
  nearestStation: Station,
): CourseGeo {
  const dist = haversineKm(courseLatLng, nearestStation);
  return {
    nearestStation,
    walkMin: Math.max(6, Math.round(dist * 15)), // 4 km/h ≈ 15 min/km
    isBus: dist > 1.5,
  };
}

// Fast offline estimate used for first-paint before TfL calls resolve.
export function offlineEstimate(origin: LatLng, geo: CourseGeo) {
  const distKm = haversineKm(origin, geo.nearestStation);
  // Same station = minimal time; otherwise rough rail estimate + overhead
  const railMin = distKm < 0.2 ? 2 : Math.round(distKm * 1.6 + 8);
  const lastMileMin = geo.isBus ? 22 : geo.walkMin;
  const minutes = railMin + lastMileMin;
  const easeScore = minutes + (geo.isBus ? 12 : 0); // changes unknown offline
  return { minutes, easeScore, estimate: true as const };
}

// Real score once TfL journey is known.
export function easeFromJourney(j: Journey) {
  return {
    minutes: j.minutes,
    changes: j.changes,
    hasBus: j.hasBus,
    easeScore: j.minutes + j.changes * 12 + (j.hasBus ? 12 : 0),
    estimate: false as const,
  };
}

// Round minutes to a human-readable band.
export function band(min: number): string {
  const m = Math.round(min / 5) * 5;          // round to nearest 5 first
  if (m < 60) return `~${m} min`;
  const h = Math.floor(m / 60);
  let rem = Math.round((m % 60) / 15) * 15;   // quarter-hours above 1 hr
  let hr = h;
  if (rem === 60) { hr += 1; rem = 0; }        // guard rounding spill at e.g. 58→60
  return rem ? `~${hr} hr ${rem}` : `~${hr} hr`;
}

// Human-readable description of how you get there.
// j === undefined  → not yet fetched; show offline estimate label
// j === null       → no transit route found
// j is Journey     → real route info
export function routeLabel(j: Journey | null | undefined, geo: CourseGeo): string {
  if (j === undefined) {
    return geo.isBus ? 'Train + bus (est.)' : `Train + ${geo.walkMin} min walk (est.)`;
  }
  if (j === null) return 'No transit route';
  const chg = j.changes === 0 ? 'direct' : `${j.changes} change${j.changes > 1 ? 's' : ''}`;
  const tail = j.hasBus
    ? 'incl. bus'
    : j.finalWalkMin
    ? `${j.finalWalkMin} min walk`
    : '';
  return [chg, tail].filter(Boolean).join(' · ');
}
