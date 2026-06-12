import coursesRaw from '../assets/data/cartpath_courses.json';
import stationsRaw from '../assets/data/cartpath_stations.json';
import { haversineKm } from './geo';
import type { LatLng } from './geo';
import type { Course, Station } from './types';

export const courses = (coursesRaw as { courses: Course[] }).courses;
export const stations = (stationsRaw as { stations: Station[] }).stations;

export function getCourseById(id: string): Course | undefined {
  return courses.find((c) => c.id === id);
}

export function getStationById(id: string): Station | undefined {
  return stations.find((s) => s.id === id);
}

export function getNearestStation(point: LatLng): Station {
  let best = stations[0];
  let bestDist = Infinity;
  for (const s of stations) {
    const d = haversineKm(point, s);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}
