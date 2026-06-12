// NOTE: react-native-maps requires a DEVELOPMENT BUILD (not Expo Go).
// iOS: works out of the box (Apple Maps, no key needed).
// Android: add ["react-native-maps", {"androidApiKey": "YOUR_KEY"}] to app.json plugins.

import { useRouter } from 'expo-router';
import Supercluster from 'supercluster';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import type { Region } from 'react-native-maps';

import { courses } from '@/src/data';
import { colors, font, space } from '@/src/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type PinProps = {
  id: string;
  name: string;
  access: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SE_REGION: Region = {
  latitude: 51.5,
  longitude: -0.2,
  latitudeDelta: 2.0,
  longitudeDelta: 2.0,
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MapTab() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(SE_REGION);

  const sc = useMemo(() => {
    const inst = new Supercluster<PinProps>({ radius: 50, maxZoom: 15 });
    inst.load(
      courses.map((c) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { id: c.id, name: c.name, access: c.access },
      })),
    );
    return inst;
  }, []);

  const clusters = useMemo(() => {
    if (!isFinite(region.longitudeDelta) || !isFinite(region.latitudeDelta)) return [];
    const zoom = Math.max(0, Math.min(Math.round(Math.log2(360 / region.longitudeDelta)), 15));
    const bbox: [number, number, number, number] = [
      region.longitude - region.longitudeDelta / 2,
      region.latitude - region.latitudeDelta / 2,
      region.longitude + region.longitudeDelta / 2,
      region.latitude + region.latitudeDelta / 2,
    ];
    try {
      return sc.getClusters(bbox, zoom);
    } catch {
      return [];
    }
  }, [sc, region]);

  const handleClusterPress = useCallback(
    (clusterId: number, lat: number, lng: number) => {
      // Guard: coordinates must be valid geographic values
      if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      let expZoom: number;
      try {
        expZoom = sc.getClusterExpansionZoom(clusterId);
      } catch {
        return;
      }

      // Guard: zoom must be finite; clamp to [1, 14] to avoid sub-millimetre deltas
      // that cause MapKit to abort with a native SIGABRT on iOS
      if (!isFinite(expZoom)) return;
      const clampedZoom = Math.min(Math.max(expZoom, 1), 14);
      const delta = Math.max(360 / Math.pow(2, clampedZoom), 0.005);
      const latDelta = Math.max(delta * 0.9, 0.005);

      if (!isFinite(delta) || !isFinite(latDelta)) return;

      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: latDelta, longitudeDelta: delta },
        300,
      );
    },
    [sc],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={SE_REGION}
        onRegionChangeComplete={setRegion}
      >
        {clusters.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const isCluster = (feature.properties as { cluster?: boolean }).cluster === true;

          if (isCluster) {
            const clProps = feature.properties as { point_count: number; cluster_id: number };
            return (
              <Marker
                key={`cl-${clProps.cluster_id}`}
                coordinate={{ latitude: lat, longitude: lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onPress={() => handleClusterPress(clProps.cluster_id, lat, lng)}
              >
                <View style={styles.cluster}>
                  <Text style={styles.clusterCount}>{clProps.point_count}</Text>
                </View>
              </Marker>
            );
          }

          const p = feature.properties as PinProps;
          const isMember = p.access === 'M';
          const fill = isMember ? colors.access.members.bg : colors.ease.easy;

          return (
            <Marker
              key={p.id}
              coordinate={{ latitude: lat, longitude: lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onCalloutPress={() =>
                router.push({ pathname: '/course/[id]', params: { id: p.id } })
              }
            >
              <View style={[styles.pin, { backgroundColor: fill }]}>
                {isMember && <Text style={styles.pinM}>M</Text>}
              </View>
              <Callout tooltip={false}>
                <View style={styles.callout}>
                  <Text style={styles.calloutName} numberOfLines={2}>{p.name}</Text>
                  {isMember && (
                    <Text style={styles.calloutLock}>Members only</Text>
                  )}
                  <Text style={styles.calloutTap}>Tap to view →</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  pin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  pinM: {
    fontSize: 6,
    fontFamily: font.sansMed,
    color: '#fff',
    lineHeight: 8,
  },

  cluster: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.pine,
    borderWidth: 2,
    borderColor: colors.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterCount: {
    fontFamily: font.sansMed,
    fontSize: 13,
    color: colors.linen,
  },

  callout: {
    width: 180,
    padding: space.sm,
    gap: 2,
  },
  calloutName: {
    fontFamily: font.sansMed,
    fontSize: 13,
    color: colors.ink,
  },
  calloutLock: {
    fontFamily: font.sans,
    fontSize: 11,
    color: colors.muted,
  },
  calloutTap: {
    fontFamily: font.sans,
    fontSize: 11,
    color: colors.brass,
    marginTop: 4,
  },

});
