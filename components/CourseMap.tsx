import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import type { Region } from 'react-native-maps';
import Supercluster from 'supercluster';
import type { BBox } from 'geojson';

import { band, routeLabel } from '@/src/score';
import type { CourseGeo } from '@/src/score';
import type { Journey } from '@/src/journey';
import { colors, font, radius, space } from '@/src/theme';
import type { CourseAccess } from '@/src/types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  access: CourseAccess;
  geo: CourseGeo;
  journey: Journey | null | undefined;
  score: { minutes: number; estimate: boolean };
}

export interface MapOrigin {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  rows: MapPoint[];
  origin: MapOrigin;
  allLoaded: boolean;
  onCoursePress: (id: string) => void;
}

// ─── Supercluster ─────────────────────────────────────────────────────────────

type PointProps = { row: MapPoint };
const SC_OPTIONS = { radius: 60, maxZoom: 16 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function longitudeDeltaToZoom(lngDelta: number): number {
  return Math.min(20, Math.max(0, Math.round(Math.log2(360 / lngDelta))));
}

function computeInitialRegion(origin: MapOrigin, rows: MapPoint[]): Region {
  if (rows.length === 0) {
    return { latitude: origin.lat, longitude: origin.lng, latitudeDelta: 0.3, longitudeDelta: 0.3 };
  }
  const MAX_DELTA = 0.6;
  let minLat = origin.lat, maxLat = origin.lat;
  let minLng = origin.lng, maxLng = origin.lng;
  for (const r of rows) {
    minLat = Math.min(minLat, r.lat);
    maxLat = Math.max(maxLat, r.lat);
    minLng = Math.min(minLng, r.lng);
    maxLng = Math.max(maxLng, r.lng);
  }
  const latDelta = Math.min((maxLat - minLat) * 1.4 + 0.04, MAX_DELTA);
  const lngDelta = Math.min((maxLng - minLng) * 1.4 + 0.04, MAX_DELTA);
  return {
    latitude: (origin.lat + (maxLat + minLat) / 2) / 2,
    longitude: (origin.lng + (maxLng + minLng) / 2) / 2,
    latitudeDelta: Math.max(latDelta, 0.08),
    longitudeDelta: Math.max(lngDelta, 0.08),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CourseMap({ rows, origin, allLoaded, onCoursePress }: Props) {
  const mapRef = useRef<MapView>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialRegion = useMemo(() => computeInitialRegion(origin, rows), []);

  const [region, setRegion] = useState<Region>(initialRegion);
  const [indexVersion, setIndexVersion] = useState(0);
  const scRef = useRef(new Supercluster<PointProps>(SC_OPTIONS));

  useEffect(() => {
    const points = rows.map((row) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [row.lng, row.lat] as [number, number] },
      properties: { row },
    }));
    scRef.current = new Supercluster<PointProps>(SC_OPTIONS);
    scRef.current.load(points);
    setIndexVersion((v) => v + 1);
  }, [rows]);

  const clusters = useMemo(() => {
    if (!Number.isFinite(region.longitudeDelta) || !Number.isFinite(region.latitudeDelta)) return [];
    if (region.longitudeDelta <= 0 || region.latitudeDelta <= 0) return [];
    const bbox: BBox = [
      region.longitude - region.longitudeDelta / 2,
      region.latitude  - region.latitudeDelta  / 2,
      region.longitude + region.longitudeDelta / 2,
      region.latitude  + region.latitudeDelta  / 2,
    ];
    if (!bbox.every(Number.isFinite)) return [];
    const zoom = longitudeDeltaToZoom(region.longitudeDelta);
    try {
      return scRef.current.getClusters(bbox, zoom);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, indexVersion]);

  const handleClusterPress = useCallback((clusterId: number, lat: number, lng: number) => {
    // Pre-flight: coordinates must be valid geographic values
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    let expZoom: number;
    try {
      expZoom = scRef.current.getClusterExpansionZoom(clusterId);
    } catch {
      return;
    }

    if (!Number.isFinite(expZoom)) return;
    // Clamp to [1,14] — maxZoom+1 (17) produces delta ~0.003 which crashes MapKit natively
    const clampedZoom = Math.min(Math.max(expZoom, 1), 14);
    const delta    = Math.max(360 / Math.pow(2, clampedZoom), 0.005);
    const latDelta = Math.max(delta * 0.9, 0.005);

    if (!Number.isFinite(delta) || !Number.isFinite(latDelta)) return;

    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: latDelta, longitudeDelta: delta },
      350,
    );
  }, []);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={initialRegion}
      onRegionChangeComplete={setRegion}
    >

      {/* ── Origin marker — prominent blue, unmistakably different ── */}
      <Marker
        coordinate={{ latitude: origin.lat, longitude: origin.lng }}
        tracksViewChanges={false}
        zIndex={999}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <View style={styles.originRing}>
          <View style={styles.originCore} />
        </View>
        <Callout tooltip={false}>
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>{origin.name}</Text>
            <Text style={styles.calloutSub}>Your starting station</Text>
          </View>
        </Callout>
      </Marker>

      {/* ── Course pins and clusters ── */}
      {clusters.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const props = feature.properties as any;

        if (props.cluster) {
          const clusterId = props.cluster_id as number;
          const count = props.point_count as number;
          return (
            <Marker
              key={`cl-${clusterId}`}
              coordinate={{ latitude: lat, longitude: lng }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => handleClusterPress(clusterId, lat, lng)}
            >
              <View style={styles.cluster}>
                <Text style={styles.clusterCount}>{count}</Text>
              </View>
            </Marker>
          );
        }

        const { row } = props as PointProps;
        const isMember = row.access === 'M';
        const timeStr = row.score.minutes < 9999 ? band(row.score.minutes) : '—';
        const routeDesc = routeLabel(row.journey, row.geo);
        const accessLabel =
          row.access === 'O' ? 'Open' : row.access === 'V' ? 'Visitors' : 'Members';
        const accessBg =
          row.access === 'O'
            ? colors.access.open.bg
            : row.access === 'V'
            ? '#B7C6BC'
            : colors.access.members.bg;
        const accessFg =
          row.access === 'O'
            ? colors.access.open.fg
            : row.access === 'V'
            ? colors.access.visitors.fg
            : colors.access.members.fg;
        const pinFill = isMember ? colors.burgundy : colors.pine;

        return (
          <Marker
            key={row.id}
            coordinate={{ latitude: row.lat, longitude: row.lng }}
            tracksViewChanges={!allLoaded}
            anchor={{ x: 0.5, y: 0.5 }}
            onCalloutPress={() => onCoursePress(row.id)}
          >
            {/* 40px touch area → white halo (30px) → brass ring (26px) → fill (22px) */}
            <View style={styles.pinTouch}>
              <View style={styles.pinHalo}>
                <View style={styles.pinBrass}>
                  <View style={[styles.pinFill, { backgroundColor: pinFill }]}>
                    {isMember
                      ? <Ionicons name="lock-closed" size={9} color="#fff" />
                      : <Ionicons name="flag"        size={9} color="#fff" />
                    }
                  </View>
                </View>
              </View>
            </View>

            <Callout tooltip={false}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle} numberOfLines={2}>{row.name}</Text>
                <View style={styles.calloutMeta}>
                  <View style={[styles.calloutBadge, { backgroundColor: accessBg }]}>
                    <Text style={[styles.calloutBadgeText, { color: accessFg }]}>
                      {accessLabel}
                    </Text>
                  </View>
                  <Text style={styles.calloutTime}>{timeStr}</Text>
                  {row.score.estimate && <Text style={styles.calloutEst}> est.</Text>}
                </View>
                <Text style={styles.calloutDesc} numberOfLines={1}>{routeDesc}</Text>
                <Text style={styles.calloutCta}>Tap to view →</Text>
              </View>
            </Callout>
          </Marker>
        );
      })}

    </MapView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  map: { flex: 1 },

  originRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1565C0',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
  },
  originCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  // Individual course pin — 40px transparent touch target wraps 30/26/22px rings
  pinTouch: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHalo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 5,
  },
  pinBrass: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinFill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cluster: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.pine,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  clusterCount: {
    fontFamily: font.sansMed,
    color: colors.linen,
    fontSize: 13,
  },

  callout: {
    width: 210,
    padding: 10,
  },
  calloutTitle: {
    fontFamily: font.serif,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 5,
    lineHeight: 18,
  },
  calloutSub: {
    fontFamily: font.sans,
    fontSize: 11,
    color: colors.muted,
  },
  calloutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    gap: space.xs,
  },
  calloutBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  calloutBadgeText: {
    fontFamily: font.sansMed,
    fontSize: 9,
  },
  calloutTime: {
    fontFamily: font.sansMed,
    fontSize: 14,
    color: colors.pine,
    fontVariant: ['tabular-nums'],
  },
  calloutEst: {
    fontFamily: font.sans,
    fontSize: 10,
    color: colors.muted,
  },
  calloutDesc: {
    fontFamily: font.sans,
    fontSize: 11,
    color: colors.muted,
    marginBottom: 5,
  },
  calloutCta: {
    fontFamily: font.sansMed,
    fontSize: 11,
    color: colors.pine,
  },
});
