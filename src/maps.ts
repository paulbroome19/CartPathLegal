import { Linking } from 'react-native';
import type { Course, Station } from './types';

// ─── Directions (transit, origin → course) ────────────────────────────────────

function buildDirectionsUrl(course: Course, origin: Station): string {
  const base = 'https://www.google.com/maps/dir/?api=1';
  const o = `&origin=${origin.lat},${origin.lng}`;
  const mode = '&travelmode=transit';
  if (course.tapOut === 'placeId' && course.placeId) {
    return (
      `${base}${o}` +
      `&destination=${course.lat},${course.lng}` +
      `&destination_place_id=${course.placeId}` +
      mode
    );
  }
  return `${base}${o}&destination=${encodeURIComponent(course.name)}${mode}`;
}

export function openDirections(course: Course, origin: Station): void {
  Linking.openURL(buildDirectionsUrl(course, origin));
}

// ─── Place card (photos, reviews, hours, website, phone) ─────────────────────

function buildPlaceUrl(course: Course): string {
  const base = 'https://www.google.com/maps/search/?api=1';
  if (course.tapOut === 'placeId' && course.placeId) {
    return `${base}&query=${encodeURIComponent(course.name)}&query_place_id=${course.placeId}`;
  }
  // fallback: search by name + area so the right club surfaces
  return `${base}&query=${encodeURIComponent(`${course.name} ${course.area}`)}`;
}

export function openPlace(course: Course): void {
  Linking.openURL(buildPlaceUrl(course));
}
