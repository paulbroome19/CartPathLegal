import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  ListRenderItem,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourseMap } from '@/components/CourseMap';
import type { MapPoint } from '@/components/CourseMap';
import { Segmented } from '@/components/Segmented';
import { Toggle } from '@/components/Toggle';
import { courses, getNearestStation, stations } from '@/src/data';
import { getJourneysBatch, tflKeyPresent } from '@/src/journey';
import type { Journey } from '@/src/journey';
import { band, easeFromJourney, makeCourseGeo, offlineEstimate } from '@/src/score';
import type { CourseGeo } from '@/src/score';
import { colors, font, radius, space, typeScale } from '@/src/theme';
import type { Course, CourseAccess, LastMile } from '@/src/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type CourseRanked = Course & {
  geo: CourseGeo;
  offlineScore: ReturnType<typeof offlineEstimate>;
};

interface RowScore {
  minutes: number;
  easeScore: number;
  estimate: boolean;
  changes?: number;
  hasBus?: boolean;
}

interface DisplayRow extends CourseRanked {
  journey: Journey | null | undefined;
  score: RowScore;
}

type WalkSeg = 'any' | '10' | '25';
type ViewMode = 'list' | 'map';

// ─── Constants ────────────────────────────────────────────────────────────────

const FETCH_LIMIT = 60;
const JOURNEY_CAP = 90;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toRowScore(row: CourseRanked, j: Journey | null | undefined): RowScore {
  if (j === undefined) return row.offlineScore;
  if (j === null) return { minutes: 9999, easeScore: 9999, estimate: false };
  return easeFromJourney(j);
}

function isCar(lastMile: LastMile): boolean {
  return lastMile === 'car';
}

function isBusLastMile(lastMile: LastMile): boolean {
  return lastMile === 'bus';
}

// ─── Journey strip ────────────────────────────────────────────────────────────

function JourneyStrip({ journey, lastMile }: { journey: Journey | null | undefined; lastMile: LastMile }) {
  if (isCar(lastMile)) {
    return (
      <View style={styles.strip}>
        <MaterialCommunityIcons name="car" size={15} color={colors.ink} />
      </View>
    );
  }

  const trainCount = journey != null ? journey.changes + 1 : 1;
  const hasBus = journey != null ? journey.hasBus : isBusLastMile(lastMile);

  const parts: React.ReactNode[] = [];

  for (let i = 0; i < trainCount; i++) {
    if (parts.length > 0) {
      parts.push(<Text key={`d${i}`} style={styles.stripDot}>·</Text>);
    }
    parts.push(
      <MaterialCommunityIcons key={`train${i}`} name="train" size={15} color={colors.ink} />,
    );
  }

  if (hasBus) {
    parts.push(<Text key="dbus" style={styles.stripDot}>·</Text>);
    parts.push(<MaterialCommunityIcons key="bus" name="bus" size={15} color={colors.ink} />);
  }

  parts.push(<Text key="dwalk" style={styles.stripDot}>·</Text>);
  parts.push(<Ionicons key="walk" name="walk" size={14} color={colors.muted} />);

  return <View style={styles.strip}>{parts}</View>;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const router = useRouter();
  const {
    stationId,
    accessFilter: afParam,
    directOnly: doParam,
    walkableOnly: woParam,
    maxWalkMin: mwParam,
    ptOnly: ptParam,
  } = useLocalSearchParams<{
    stationId: string;
    accessFilter: string;
    directOnly: string;
    walkableOnly: string;
    maxWalkMin: string;
    ptOnly: string;
  }>();

  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [nameSearchVisible, setNameSearchVisible] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const nameInputRef = useRef<TextInput>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [liveJourneys, setLiveJourneys] = useState<Map<string, Journey | null>>(new Map());
  const [allLoaded, setAllLoaded] = useState(false);

  // Filter state — seeded from URL params passed by home screen
  const [allowVisitors, setAllowVisitors] = useState(() => afParam !== 'all');
  const [directOnly, setDirectOnly] = useState(() => doParam === '1');
  const [showBuses, setShowBuses] = useState(() => woParam !== '1');
  const [publicTransportOnly, setPublicTransportOnly] = useState(() => ptParam !== '0');
  const [maxWalkSeg, setMaxWalkSeg] = useState<WalkSeg>(() => {
    if (mwParam === '10' || mwParam === '25') return mwParam as WalkSeg;
    return 'any';
  });

  const cancelRef = useRef(false);
  const journeysAccum = useRef<Map<string, Journey | null>>(new Map());

  // Dismiss keyboard when leaving this screen (e.g. back to Home)
  useFocusEffect(
    useCallback(() => {
      return () => { Keyboard.dismiss(); };
    }, [])
  );

  const origin = useMemo(
    () => stations.find((s) => s.id === stationId) ?? null,
    [stationId],
  );

  const allRanked = useMemo<CourseRanked[]>(() => {
    if (!origin) return [];
    return courses
      .map((c) => {
        const ns = getNearestStation(c);
        const geo = makeCourseGeo(c, ns);
        const offlineScore = offlineEstimate(origin, geo);
        return { ...c, geo, offlineScore };
      })
      .sort((a, b) => a.offlineScore.easeScore - b.offlineScore.easeScore);
  }, [origin]);

  const offlineFiltered = useMemo<CourseRanked[]>(() => {
    const maxWalk = maxWalkSeg === 'any' ? 0 : Number(maxWalkSeg);
    const reachable: CourseRanked[] = [];
    const carRows: CourseRanked[] = [];

    for (const row of allRanked) {
      if (isCar(row.lastMile)) {
        if (!publicTransportOnly) carRows.push(row);
        continue;
      }
      if (allowVisitors && row.access === 'M') continue;
      if (!showBuses && isBusLastMile(row.lastMile)) continue;
      if (maxWalk > 0 && row.geo.walkMin > maxWalk) continue;
      if (row.offlineScore.minutes > JOURNEY_CAP) continue;
      reachable.push(row);
    }

    carRows.sort((a, b) => a.offlineScore.easeScore - b.offlineScore.easeScore);
    return [...reachable, ...carRows];
  }, [allRanked, allowVisitors, showBuses, maxWalkSeg, publicTransportOnly]);

  useEffect(() => {
    if (!origin || !allRanked.length) return;
    cancelRef.current = false;
    journeysAccum.current = new Map();
    setLiveJourneys(new Map());
    setAllLoaded(false);

    const items = allRanked.slice(0, FETCH_LIMIT).map((c) => ({
      id: c.id,
      dest: { lat: c.lat, lng: c.lng },
    }));

    getJourneysBatch(origin, items, (id, j) => {
      if (cancelRef.current) return;
      journeysAccum.current.set(id, j);
      setLiveJourneys(new Map(journeysAccum.current));
    })
      .then(() => { if (!cancelRef.current) setAllLoaded(true); })
      .catch(() => { if (!cancelRef.current) setAllLoaded(true); });

    return () => { cancelRef.current = true; };
  }, [allRanked]);

  const displayRows = useMemo<DisplayRow[]>(() => {
    const withLive = offlineFiltered.map((row) => {
      const j = liveJourneys.get(row.id);
      return { ...row, journey: j, score: toRowScore(row, j) };
    });

    if (!allLoaded) return withLive;

    const reachable = withLive.filter((row) => !isCar(row.lastMile));
    const carRows = withLive.filter((row) => isCar(row.lastMile));

    const sortedReachable = [...reachable]
      .sort((a, b) => {
        if (a.score.easeScore !== b.score.easeScore) return a.score.easeScore - b.score.easeScore;
        if (a.score.estimate !== b.score.estimate) return a.score.estimate ? 1 : -1;
        return 0;
      })
      .filter((row) => {
        if (directOnly && row.journey != null && row.journey.changes !== 0) return false;
        if (!showBuses && row.journey != null && row.journey.hasBus) return false;
        return true;
      });

    return [...sortedReachable, ...carRows];
  }, [offlineFiltered, liveJourneys, allLoaded, directOnly, showBuses]);

  // Name search overrides filters — searches all courses including car/over-cap
  const finalRows = useMemo<DisplayRow[]>(() => {
    const q = nameSearch.trim().toLowerCase();
    if (!q) return displayRows;

    const allWithLive = allRanked.map((row) => {
      const j = liveJourneys.get(row.id);
      return { ...row, journey: j, score: toRowScore(row, j) };
    });
    return allWithLive
      .filter((row) => row.name.toLowerCase().includes(q))
      .sort((a, b) => a.score.easeScore - b.score.easeScore);
  }, [nameSearch, displayRows, allRanked, liveJourneys]);

  // Map rows — non-car courses in MapPoint format for the CourseMap component
  const mapRows = useMemo<MapPoint[]>(() => {
    return finalRows
      .filter((row) => !isCar(row.lastMile))
      .map((row) => ({
        id: row.id,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        access: row.access as CourseAccess,
        geo: row.geo,
        journey: row.journey,
        score: { minutes: row.score.minutes, estimate: row.score.estimate },
      }));
  }, [finalRows]);

  const noApiMode =
    !tflKeyPresent ||
    (allLoaded && liveJourneys.size > 0 && [...liveJourneys.values()].every((j) => j === null));

  const handleCoursePress = useCallback(
    (id: string) => {
      if (!origin) return;
      router.push({ pathname: '/course/[id]', params: { id, from: origin.id } });
    },
    [origin, router],
  );

  const toggleNameSearch = useCallback(() => {
    setNameSearchVisible((v) => {
      if (v) setNameSearch('');
      return !v;
    });
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }, []);

  const renderRow: ListRenderItem<DisplayRow> = useCallback(
    ({ item: row }) => {
      const isNoRoute = row.journey === null && !isCar(row.lastMile);
      const timeStr = row.score.minutes < 9999 ? band(row.score.minutes) : '—';

      return (
        <TouchableOpacity
          style={[styles.row, isNoRoute && styles.rowDim]}
          onPress={() => handleCoursePress(row.id)}
          activeOpacity={0.65}
        >
          <View style={styles.rowPad}>
            <View style={styles.rowInner}>
              <View style={styles.rowLeft}>
                <View style={styles.nameRow}>
                  <Text style={styles.courseName} numberOfLines={1}>
                    {row.name}
                  </Text>
                  {row.access === 'M' && (
                    <Ionicons
                      name="lock-closed"
                      size={13}
                      color={colors.burgundy}
                      style={styles.lockIcon}
                    />
                  )}
                </View>
                <JourneyStrip journey={row.journey} lastMile={row.lastMile} />
              </View>

              <View style={styles.rowRight}>
                <Text style={styles.timeStr}>{timeStr}</Text>
                {!isCar(row.lastMile) && (
                  <View style={styles.walkRow}>
                    <Ionicons name="walk" size={12} color={colors.muted} />
                    <Text style={styles.walkStr}>{row.geo.walkMin} min</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [handleCoursePress],
  );

  if (!origin) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.content}>
          <Text style={styles.errorText}>Station not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.content}>

      {/* ── Pine header — back LEFT · toggle CENTRE (absolute) · filter RIGHT ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { Keyboard.dismiss(); router.back(); }}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.linen} />
        </TouchableOpacity>

        {/* Toggle sits absolutely so it is dead-centred regardless of button widths */}
        <View style={styles.headerCenter} pointerEvents="box-none">
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <Ionicons name="list" size={20} color={viewMode === 'list' ? colors.brassText : colors.linen} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('map')}
              activeOpacity={0.7}
            >
              <Ionicons name="map-outline" size={20} color={viewMode === 'map' ? colors.brassText : colors.linen} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={() => setFilterSheetVisible(true)}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={20} color={colors.linen} />
        </TouchableOpacity>
      </View>

      {/* ── Station name block — search toggle lives here ── */}
      <View style={styles.stationBar}>
        <View style={styles.stationRow}>
          <View style={styles.stationTextBlock}>
            <Text style={styles.stationLabel}>Departing</Text>
            <Text style={styles.stationName} numberOfLines={1}>{origin.name}</Text>
          </View>
          <View style={styles.stationActions}>
            {!allLoaded && (
              <ActivityIndicator size="small" color={colors.muted} style={styles.loader} />
            )}
            <TouchableOpacity onPress={toggleNameSearch} style={styles.searchBtn} activeOpacity={0.7}>
              <Ionicons
                name={nameSearchVisible ? 'close-outline' : 'search-outline'}
                size={20}
                color={nameSearchVisible ? colors.brass : colors.muted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Name search bar — expands below station block ── */}
      {nameSearchVisible && (
        <View style={styles.nameSearchBar}>
          <Ionicons name="search-outline" size={16} color={colors.muted} />
          <TextInput
            ref={nameInputRef}
            style={styles.nameSearchInput}
            value={nameSearch}
            onChangeText={setNameSearch}
            placeholder="Search courses by name…"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            returnKeyType="search"
          />
          {nameSearch.length > 0 && (
            <TouchableOpacity onPress={() => setNameSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── No-API banner ── */}
      {noApiMode && (
        <View style={styles.apiBanner}>
          <Text style={styles.apiBannerText}>
            Journey detail unavailable — showing distance estimates
          </Text>
        </View>
      )}

      {/* ── Course list or map ── */}
      {viewMode === 'list' ? (
        <FlatList
          data={finalRows}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {nameSearch
                ? `No courses matching "${nameSearch}"`
                : 'No courses match the current filters.'}
            </Text>
          }
        />
      ) : (
        <CourseMap
          rows={mapRows}
          origin={{ id: origin.id, name: origin.name, lat: origin.lat, lng: origin.lng }}
          allLoaded={allLoaded}
          onCoursePress={handleCoursePress}
        />
      )}

      {/* ── Filter bottom sheet ── */}
      <Modal
        visible={filterSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setFilterSheetVisible(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setFilterSheetVisible(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </TouchableOpacity>
          </View>

          {/* Reachability */}
          <Text style={styles.sheetSectionHead}>Reachability</Text>
          <View style={styles.filterCard}>
            <View style={styles.toggleRow}>
              <Text style={styles.filterLabel}>Public Transport Only</Text>
              <Toggle value={publicTransportOnly} onValueChange={setPublicTransportOnly} />
            </View>
          </View>

          {/* Access */}
          <Text style={styles.sheetSectionHead}>Access</Text>
          <View style={styles.filterCard}>
            <View style={styles.toggleRow}>
              <Text style={styles.filterLabel}>Allows Visitors</Text>
              <Toggle value={allowVisitors} onValueChange={setAllowVisitors} />
            </View>
          </View>

          {/* Journey */}
          <Text style={styles.sheetSectionHead}>Journey</Text>
          <View style={styles.filterCard}>

            <View style={styles.segBlock}>
              <Text style={styles.filterLabel}>Walking Time From Station (Mins)</Text>
              <Segmented<WalkSeg>
                options={[
                  { label: 'Any',  value: 'any' },
                  { label: '≤ 10', value: '10' },
                  { label: '≤ 25', value: '25' },
                ]}
                value={maxWalkSeg}
                onChange={setMaxWalkSeg}
              />
            </View>

            <View style={styles.filterDivider} />

            <View style={styles.toggleRow}>
              <Text style={styles.filterLabel}>Show Direct Trains Only</Text>
              <Toggle value={directOnly} onValueChange={setDirectOnly} />
            </View>

            <View style={styles.filterDivider} />

            <View style={styles.toggleRow}>
              <Text style={styles.filterLabel}>Show Journeys With Buses</Text>
              <Toggle value={showBuses} onValueChange={setShowBuses} />
            </View>

          </View>
        </View>
      </Modal>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pine },
  content: { flex: 1, backgroundColor: colors.linen },

  // Pine header — back + list/map toggle + filter (no search icon here)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pine,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.brass,
  },
  headerBtn: {
    padding: space.sm,
    minWidth: 44,
    alignItems: 'center',
  },
  // Absolutely centred wrapper — pointerEvents="box-none" lets side buttons receive taps
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  // List / Map toggle (prominently centred in header)
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    padding: 3,
  },
  viewToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: {
    backgroundColor: colors.brass,
  },

  // Station name block — also houses the search toggle
  stationBar: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stationTextBlock: { flex: 1, marginRight: space.sm },
  stationLabel: {
    ...typeScale.label,
    color: colors.muted,
    marginBottom: 2,
  },
  stationName: {
    ...typeScale.h1,
    color: colors.ink,
  },
  stationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  loader: { marginRight: 2 },
  searchBtn: { padding: space.xs },

  // Name search bar (appears below station block)
  nameSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  nameSearchInput: {
    flex: 1,
    fontFamily: font.sans,
    fontSize: 15,
    color: colors.ink,
    height: 36,
  },

  // No-API banner
  apiBanner: {
    backgroundColor: '#FFFBEF',
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8C4',
  },
  apiBannerText: { fontFamily: font.sans, fontSize: 12, color: '#7A6000' },

  // White-card list
  listContent: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: 40 },

  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.hairline,
    marginBottom: 8,
  },
  rowPad: {
    paddingHorizontal: space.md,
    paddingVertical: 13,
  },
  rowDim: { opacity: 0.35 },

  // ── Shared row internals ──
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLeft: {
    flex: 1,
    gap: 5,
    marginRight: space.md,
  },
  rowRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  courseName: {
    ...typeScale.h2,
    color: colors.ink,
    flexShrink: 1,
  },
  lockIcon: { flexShrink: 0 },

  // Journey strip
  strip: { flexDirection: 'row', alignItems: 'center' },
  stripDot: {
    fontFamily: font.sans,
    fontSize: 10,
    color: colors.muted,
    marginHorizontal: 2,
    lineHeight: 15,
  },

  // Time + walk
  timeStr: {
    ...typeScale.tabular,
    fontSize: 20,
    color: colors.pine,
  },
  walkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  walkStr: {
    fontFamily: font.sans,
    fontSize: 11,
    color: colors.muted,
  },

  // Empty / error
  emptyText: {
    paddingTop: 60,
    textAlign: 'center',
    fontFamily: font.sans,
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: 40,
  },
  errorText: {
    padding: 32,
    fontFamily: font.sans,
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
  },

  // Filter sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.linen,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: space.lg,
    paddingBottom: 36,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
    alignSelf: 'center',
    marginBottom: space.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  sheetTitle: {
    fontFamily: font.sansMed,
    fontSize: 17,
    color: colors.ink,
  },

  // Filter controls in sheet
  sheetSectionHead: {
    ...typeScale.label,
    color: colors.brassMuted,
    marginBottom: 8,
  },
  filterCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  filterLabel: {
    fontFamily: font.sans,
    fontSize: 14,
    color: colors.ink,
    flex: 1,
  },
  filterDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
  segBlock: {
    paddingVertical: 12,
    gap: 10,
  },
});
