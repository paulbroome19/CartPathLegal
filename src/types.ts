export type CourseAccess = 'O' | 'V' | 'M';
export type CourseTapOut = 'placeId' | 'search';
export type StationMode = 'rail' | 'tube' | 'dlr' | 'overground' | 'elizabeth' | 'tram';
// 'short_walk' is current data; 'walk'/'bus'/'car' per spec (car arrives with new JSON)
export type LastMile = 'short_walk' | 'walk' | 'bus' | 'car';

export interface Course {
  id: string;
  name: string;
  lat: number;
  lng: number;
  placeId: string;
  area: string;
  county: string;
  access: CourseAccess;
  tapOut: CourseTapOut;
  lastMile: LastMile;
  nearestStation: string;
  nearestStationId: string;
  stationWalkMin: number;
  busStopM: number;
  busStopWalkMin: number;
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  modes: StationMode[];
}
