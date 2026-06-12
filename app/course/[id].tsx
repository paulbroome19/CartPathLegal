import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCourseById, getStationById } from '@/src/data';
import { getJourney, tflKeyPresent } from '@/src/journey';
import type { Journey } from '@/src/journey';
import { openDirections, openPlace } from '@/src/maps';
import { band, offlineEstimate } from '@/src/score';
import type { CourseGeo } from '@/src/score';
import { colors, font, radius, space, typeScale } from '@/src/theme';
import type { CourseAccess, LastMile } from '@/src/types';

// ─── Access config ────────────────────────────────────────────────────────────

const ACCESS_CFG: Record<
  CourseAccess,
  { label: string; dot: string; fg: string; border: string; note: string | null }
> = {
  O: {
    label: 'Open to All',
    dot: colors.sage,
    fg: colors.muted,
    border: colors.hairline,
    note: null,
  },
  V: {
    label: 'Visitors Welcome',
    dot: colors.brassMuted,
    fg: colors.muted,
    border: colors.hairline,
    note: null,
  },
  M: {
    label: 'Members & Guests Only',
    dot: colors.burgundy,
    fg: colors.burgundy,
    border: colors.burgundy,
    note: "You'll need an invitation or to arrange a visit in advance.",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isCarTier(lastMile: LastMile): boolean {
  return lastMile === 'car';
}

function isBusTier(lastMile: LastMile): boolean {
  return lastMile === 'bus';
}

function trainLabel(j: Journey | null | undefined, from: string, to: string): string {
  const base = `Train from ${from} to ${to}`;
  if (j == null) return base;
  const ch = j.changes === 0 ? 'direct' : `${j.changes} change${j.changes === 1 ? '' : 's'}`;
  return `${base} (${ch})`;
}

// ─── Step row types ───────────────────────────────────────────────────────────

type StepGlyph = 'train' | 'bus' | 'walk' | 'car';

interface RouteStep {
  glyph: StepGlyph;
  label: string;
}

function StepIcon({ glyph }: { glyph: StepGlyph }) {
  if (glyph === 'train') return <MaterialCommunityIcons name="train" size={17} color={colors.ink} />;
  if (glyph === 'bus')   return <MaterialCommunityIcons name="bus"   size={17} color={colors.ink} />;
  if (glyph === 'car')   return <MaterialCommunityIcons name="car"   size={17} color={colors.muted} />;
  return <MaterialCommunityIcons name="walk" size={17} color={colors.muted} />;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CourseScreen() {
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from: string }>();

  const course = useMemo(() => getCourseById(id ?? ''), [id]);
  const origin = useMemo(() => getStationById(from ?? ''), [from]);

  // Build a CourseGeo from bundled data so offlineEstimate has what it needs
  const geo = useMemo<CourseGeo | null>(() => {
    if (!course) return null;
    const station = getStationById(course.nearestStationId);
    if (!station) return null;
    return {
      nearestStation: station,
      walkMin: course.stationWalkMin,
      isBus: isBusTier(course.lastMile),
    };
  }, [course]);

  const offline = useMemo(() => {
    if (!origin || !geo) return null;
    return offlineEstimate(origin, geo);
  }, [origin, geo]);

  const [journey, setJourney] = useState<Journey | null | undefined>(undefined);

  useEffect(() => {
    if (!origin || !course || isCarTier(course.lastMile) || !tflKeyPresent) return;
    let cancelled = false;
    getJourney(origin, course)
      .then((j) => { if (!cancelled) setJourney(j); })
      .catch(() => { if (!cancelled) setJourney(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, origin?.id]);

  // ── Derived display ──────────────────────────────────────────────────────

  const routeSteps = useMemo<RouteStep[]>(() => {
    if (!course || !origin) return [];

    if (isCarTier(course.lastMile)) {
      return [{
        glyph: 'car',
        label: 'No practical public transport route — this course needs a car.',
      }];
    }

    const steps: RouteStep[] = [];
    const sameStation = course.nearestStationId === origin.id;

    if (!sameStation) {
      steps.push({
        glyph: 'train',
        label: trainLabel(journey, origin.name, course.nearestStation),
      });
    }

    if (isBusTier(course.lastMile)) {
      steps.push({ glyph: 'bus',  label: 'Bus toward the course' });
      steps.push({ glyph: 'walk', label: `Walk ~${course.busStopWalkMin} min from the stop` });
    } else {
      steps.push({ glyph: 'walk', label: `Walk ~${course.stationWalkMin} min to the course` });
    }

    return steps;
  }, [course, origin, journey]);

  const totalMinutes = useMemo<number | null>(() => {
    if (!course || isCarTier(course.lastMile)) return null;
    if (journey != null) return journey.minutes;
    return offline?.minutes ?? null;
  }, [course, journey, offline]);

  const isEstimate = journey == null; // undefined (pending) or null (failed) → show (est.)
  const timeStr = totalMinutes != null ? band(totalMinutes) : null;

  // ── Error states ─────────────────────────────────────────────────────────

  if (!course) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color={colors.linen} />
            </TouchableOpacity>
          </View>
          <Text style={styles.errorText}>Course not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!origin) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color={colors.linen} />
            </TouchableOpacity>
            <Text style={styles.headerName} numberOfLines={1}>{course.name}</Text>
          </View>
          <Text style={styles.errorText}>
            Return to search and choose a station to see journey details.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const accessCfg = ACCESS_CFG[course.access] ?? ACCESS_CFG.V;
  const carCourse = isCarTier(course.lastMile);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="light" />
      <View style={styles.content}>

      {/* ── Pine header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.linen} />
        </TouchableOpacity>
        <Text style={styles.headerName} numberOfLines={1}>{course.name}</Text>
        {course.access === 'M' && (
          <View style={styles.headerLockWrap}>
            <Ionicons name="lock-closed" size={12} color={colors.access.members.fg} />
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Identity ── */}
        <Text style={styles.courseName}>{course.name}</Text>
        <Text style={styles.courseLocation}>{course.area} · {course.county}</Text>

        {/* ── Access pill ── */}
        <View style={[styles.accessPill, { borderColor: accessCfg.border }]}>
          <View style={[styles.accessDot, { backgroundColor: accessCfg.dot }]} />
          <Text style={[styles.accessPillLabel, { color: accessCfg.fg }]}>
            {accessCfg.label}
          </Text>
        </View>
        {accessCfg.note != null && (
          <Text style={styles.accessNote}>{accessCfg.note}</Text>
        )}

        {/* ── Predicted Route card ── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionHead}>Predicted Route</Text>
          <Text style={styles.cardFromLine}>From {origin.name}</Text>

          <View style={styles.stepsContainer}>
            {routeSteps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <View style={styles.iconWrap}>
                    <StepIcon glyph={step.glyph} />
                  </View>
                  {i < routeSteps.length - 1 && <View style={styles.connector} />}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    step.glyph === 'car'  && styles.stepLabelMuted,
                    step.glyph === 'walk' && styles.stepLabelMuted,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Total time — only for non-car courses */}
          {!carCourse && timeStr != null && (
            <>
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>Predicted Total</Text>
                  <Text style={styles.totalTime}>
                    {timeStr}
                    {isEstimate && (
                      <Text style={styles.estTag}> (est.)</Text>
                    )}
                  </Text>
                </View>
                {journey === undefined && tflKeyPresent && (
                  <Text style={styles.fetchingHint}>Fetching live route…</Text>
                )}
              </View>
              <Text style={styles.caveat}>
                Estimated route and time — check live times before you travel.
              </Text>
            </>
          )}
        </View>

      </ScrollView>

      {/* ── Fixed action buttons ── */}
      <View style={styles.buttonArea}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => openDirections(course, origin)}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate-outline" size={18} color={colors.linen} style={{ marginRight: 6 }} />
          <Text style={styles.primaryBtnText}>Get Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => openPlace(course)}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>View on Google Maps</Text>
        </TouchableOpacity>
      </View>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const ICON_COL = 34;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pine },
  content: { flex: 1, backgroundColor: colors.linen },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pine,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.brass,
    gap: space.xs,
  },
  headerBtn: {
    padding: space.sm,
    minWidth: 40,
    alignItems: 'center',
  },
  headerName: {
    flex: 1,
    fontFamily: font.serif,
    fontSize: 17,
    color: colors.linen,
    letterSpacing: -0.2,
  },
  headerLockWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.access.members.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.xs,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: space.lg, paddingBottom: 32 },

  // Identity
  courseName: {
    ...typeScale.h1,
    color: colors.ink,
    lineHeight: 32,
    marginBottom: 4,
  },
  courseLocation: {
    ...typeScale.caption,
    marginBottom: space.lg,
  },

  // Access pill
  accessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    gap: space.xs,
    marginBottom: space.xs,
  },
  accessDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  accessPillLabel: {
    ...typeScale.label,
  },
  accessNote: {
    ...typeScale.caption,
    color: colors.burgundy,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: space.lg,
  },

  // Route card
  card: {
    marginTop: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: space.lg,
  },
  cardSectionHead: {
    ...typeScale.label,
    color: colors.brassMuted,
    marginBottom: 4,
  },
  cardFromLine: {
    ...typeScale.caption,
    marginBottom: space.lg,
  },

  // Step rows
  stepsContainer: { gap: 0 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepLeft: {
    width: ICON_COL,
    alignItems: 'center',
  },
  iconWrap: {
    width: ICON_COL,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 1.5,
    flex: 1,
    minHeight: 8,
    backgroundColor: colors.hairline,
  },
  stepLabel: {
    flex: 1,
    fontFamily: font.sans,
    fontSize: 14,
    color: colors.ink,
    marginLeft: space.xs,
    paddingTop: 8,
    paddingBottom: space.sm,
    lineHeight: 20,
  },
  stepLabelMuted: {
    color: colors.muted,
  },

  // Total + caveat
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginVertical: space.md,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  totalLabel: {
    ...typeScale.label,
    color: colors.muted,
    marginBottom: 2,
  },
  totalTime: {
    ...typeScale.display,
    fontVariant: ['tabular-nums'],
    color: colors.pine,
    lineHeight: 38,
  },
  estTag: {
    fontFamily: font.sans,
    fontSize: 14,
    color: colors.muted,
  },
  fetchingHint: {
    fontFamily: font.sans,
    fontSize: 11,
    color: colors.muted,
    fontStyle: 'italic',
    paddingBottom: 4,
  },
  caveat: {
    fontFamily: font.sans,
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    fontStyle: 'italic',
  },

  // Buttons
  buttonArea: {
    padding: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pine,
    borderRadius: radius.lg,
    paddingVertical: 16,
  },
  primaryBtnText: {
    fontFamily: font.sansMed,
    color: colors.linen,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: colors.pine,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: font.sansMed,
    color: colors.pine,
    fontSize: 15,
    letterSpacing: 0.1,
  },

  // Errors
  errorText: {
    padding: 32,
    fontFamily: font.sans,
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 24,
  },
});
