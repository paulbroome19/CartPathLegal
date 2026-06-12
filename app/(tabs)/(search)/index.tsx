import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  ListRenderItem,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Segmented } from '@/components/Segmented';
import { Toggle } from '@/components/Toggle';
import { stations } from '@/src/data';
import { MODE_META, MODE_ORDER } from '@/src/modes';
import { colors, font, space, typeScale } from '@/src/theme';
import type { Station } from '@/src/types';

// ── Assets ────────────────────────────────────────────────────────────────────
const LOGO = require('@/assets/images/logo.png');
const HERO = require('@/assets/images/hero.jpg');

const HERO_HEIGHT = 240;
const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Station search ────────────────────────────────────────────────────────────
function searchStations(q: string): Station[] {
  const s = q.toLowerCase().trim();
  if (!s) return [];
  const prefix: Station[] = [];
  const rest: Station[] = [];
  for (const st of stations) {
    const n = st.name.toLowerCase();
    if (n.startsWith(s)) prefix.push(st);
    else if (n.includes(s)) rest.push(st);
  }
  return [...prefix, ...rest].slice(0, 25);
}

// ── Filter types ──────────────────────────────────────────────────────────────
type WalkSeg = 'any' | '10' | '25';

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [inputText, setInputText]         = useState('');
  const [query, setQuery]                 = useState('');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [inputHighlighted, setInputHighlighted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [allowVisitors, setAllowVisitors]         = useState(true);
  const [walkSeg, setWalkSeg]                     = useState<WalkSeg>('any');
  const [directOnly, setDirectOnly]               = useState(false);
  const [showBuses, setShowBuses]                 = useState(true);
  const [publicTransportOnly, setPublicTransportOnly] = useState(true);

  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    setSelectedStation(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(text), 150);
  }, []);

  const suggestions = useMemo(() => searchStations(query), [query]);

  const navigateToResults = useCallback(
    (stationId: string) => {
      router.push({
        pathname: '/results',
        params: {
          stationId,
          accessFilter: allowVisitors ? 'playable' : 'all',
          directOnly:   directOnly ? '1' : '0',
          walkableOnly: showBuses ? '0' : '1',
          maxWalkMin:   walkSeg,
          ptOnly:       publicTransportOnly ? '1' : '0',
        },
      });
    },
    [router, allowVisitors, directOnly, showBuses, walkSeg, publicTransportOnly],
  );

  const handleSelectStation = useCallback((station: Station) => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    setSelectedStation(station);
    setInputText(station.name);
    setQuery('');
  }, []);

  const effectiveStation = useMemo<Station | null>(() => {
    if (selectedStation) return selectedStation;
    const t = inputText.trim().toLowerCase();
    if (!t) return null;
    return stations.find((s) => s.name.toLowerCase() === t) ?? null;
  }, [selectedStation, inputText]);

  const handleFindCourses = useCallback(() => {
    if (effectiveStation) {
      navigateToResults(effectiveStation.id);
    } else {
      inputRef.current?.focus();
      setInputHighlighted(true);
      setTimeout(() => setInputHighlighted(false), 1000);
    }
  }, [effectiveStation, navigateToResults]);

  const renderSuggestion: ListRenderItem<Station> = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.suggRow}
        onPress={() => handleSelectStation(item)}
        activeOpacity={0.65}
      >
        <Text style={styles.stationName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.modeIcons}>
          {[...item.modes]
            .sort((a, b) => MODE_ORDER.indexOf(a) - MODE_ORDER.indexOf(b))
            .map((mode) => {
              const color = MODE_META[mode];
              if (!color) return null;
              return (
                <MaterialCommunityIcons
                  key={mode}
                  name="train"
                  size={16}
                  color={color}
                />
              );
            })}
        </View>
      </TouchableOpacity>
    ),
    [handleSelectStation],
  );

  const showSuggestions = query.trim() !== '' && !selectedStation;

  return (
    // Root — linen background; hero sits absolutely at the top
    <View style={styles.root}>

      {/* ── Hero image — full-bleed, anchored at very top ── */}
      <Image source={HERO} style={styles.hero} resizeMode="cover" />

      {/* ── Content — starts at hero bottom, overlaps by 27px via searchSection ── */}
      <View style={[styles.content, { paddingTop: HERO_HEIGHT }]}>

        {/* ── Search input — straddles hero bottom ── */}
        <View style={styles.searchSection}>
          <View style={[styles.inputRow, inputHighlighted && styles.inputRowHighlighted]}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputText}
              onChangeText={handleTextChange}
              placeholder="Departing From?"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
            />
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.muted}
              style={styles.searchIcon}
            />
          </View>
        </View>

        {/* ── Suggestions or main body ── */}
        {showSuggestions ? (
          <FlatList
            style={styles.suggList}
            data={suggestions}
            keyExtractor={(item) => item.id}
            renderItem={renderSuggestion}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No stations found for "{query}"</Text>
            }
          />
        ) : (
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 84 }]}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Find Courses ── */}
            <TouchableOpacity
              style={styles.findBtn}
              onPress={handleFindCourses}
              activeOpacity={0.8}
            >
              <Text style={styles.findBtnLabel}>Find Courses</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.linen} />
            </TouchableOpacity>

            {/* ── Reachability ── */}
            <Text style={styles.sectionHead}>Reachability</Text>
            <View style={styles.filterCard}>
              <View style={styles.toggleRow}>
                <Text style={styles.filterLabel}>Public Transport Only</Text>
                <Toggle value={publicTransportOnly} onValueChange={setPublicTransportOnly} />
              </View>
            </View>

            {/* ── Access ── */}
            <Text style={styles.sectionHead}>Access</Text>
            <View style={styles.filterCard}>
              <View style={styles.toggleRow}>
                <Text style={styles.filterLabel}>Allows Visitors</Text>
                <Toggle value={allowVisitors} onValueChange={setAllowVisitors} />
              </View>
            </View>

            {/* ── Journey ── */}
            <Text style={styles.sectionHead}>Journey</Text>
            <View style={styles.filterCard}>

              <View style={styles.segBlock}>
                <Text style={styles.filterLabel}>Walking Time From Station (Mins)</Text>
                <Segmented<WalkSeg>
                  options={[
                    { label: 'Any',  value: 'any' },
                    { label: '≤ 10', value: '10' },
                    { label: '≤ 25', value: '25' },
                  ]}
                  value={walkSeg}
                  onChange={setWalkSeg}
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
          </ScrollView>
        )}
      </View>

      {/* ── Logo — overlaid on hero, horizontally centred, below notch ── */}
      <View style={[styles.logoBadgeOuter, { top: insets.top + 12 }]}>
        <View style={styles.logoBadgeRing}>
          <View style={styles.logoBadge}>
            <Image source={LOGO} style={styles.logoImage} resizeMode="cover" />
          </View>
        </View>
      </View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Root — no SafeAreaView so hero reaches the very top
  root: { flex: 1, backgroundColor: colors.linen },

  // Hero image — absolutely anchored at y:0, full width
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },

  // Logo badge — absolute, horizontally centred on hero; top is set inline via insets
  logoBadgeOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logoBadgeRing: {
    width: 51,
    height: 51,
    borderRadius: 25.5,
    backgroundColor: colors.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.pine,
    overflow: 'hidden',
  },
  logoImage: { width: 48, height: 48 },

  // Content sits on top of hero; paddingTop is set inline to HERO_HEIGHT
  content: { flex: 1 },

  // Search section — overlaps bottom of hero via negative margin
  searchSection: {
    paddingHorizontal: 20,
    marginTop: -27,
    zIndex: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.hairline,
    borderRadius: 14,
    paddingHorizontal: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  inputRowHighlighted: {
    borderColor: colors.brass,
    borderWidth: 1.5,
  },
  searchIcon: { marginLeft: 8 },
  input: {
    flex: 1,
    height: 54,
    fontFamily: font.sans,
    fontSize: 15,
    color: colors.ink,
  },

  // Suggestion list
  suggList: { flex: 1, backgroundColor: colors.linen },
  suggRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.linen,
  },
  stationName: {
    flex: 1,
    fontFamily: font.sansMed,
    fontSize: 15,
    color: colors.ink,
    marginRight: space.sm,
  },
  modeIcons: { flexDirection: 'row', gap: 4, flexShrink: 0 },

  // Main body
  bodyScroll: { flex: 1 },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  // Find Courses button
  findBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginBottom: 20,
    backgroundColor: colors.pine,
  },
  findBtnLabel: {
    fontFamily: font.sansMed,
    fontSize: 16,
    color: colors.linen,
  },

  // Filter section headings
  sectionHead: {
    ...typeScale.label,
    color: colors.brassMuted,
    marginBottom: 8,
  },

  // Filter card
  filterCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    marginBottom: 16,
  },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },

  // Segment block
  segBlock: {
    paddingVertical: 12,
    gap: 10,
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

  emptyText: {
    paddingTop: 40,
    textAlign: 'center',
    fontFamily: font.sans,
    fontSize: 14,
    color: colors.muted,
  },
});
