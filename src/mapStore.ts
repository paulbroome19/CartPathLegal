// Simple pub-sub store so the Results screen can push its current row set
// to the Map tab without React Context crossing the tab boundary.

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  access: string;
  lastMile: string;
  minutes: number;
  isEstimate: boolean;
}

export interface MapState {
  origin: { id: string; name: string; lat: number; lng: number } | null;
  pins: MapPin[];
}

let _state: MapState = { origin: null, pins: [] };
const _listeners = new Set<(s: MapState) => void>();

export function setMapState(next: MapState): void {
  _state = next;
  _listeners.forEach((fn) => fn(_state));
}

export function getMapState(): MapState {
  return _state;
}

export function subscribeMapState(fn: (s: MapState) => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
