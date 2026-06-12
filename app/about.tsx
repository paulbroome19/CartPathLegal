import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, font, radius, space } from '@/src/theme';

// ─── Edit these before shipping ──────────────────────────────────────────────

const PRIVACY_URL   = 'https://example.com/privacy';   // TODO: replace
const TERMS_URL     = '';                               // optional — hide row if empty
const CONTACT_EMAIL = 'hello@cartpath.app';             // TODO: replace

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function openLink(url: string): Promise<void> {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    // no handler available on device
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function AttributionRow({ text }: { text: string }) {
  return (
    <View style={styles.attrRow}>
      <View style={styles.attrDot} />
      <Text style={styles.attrText}>{text}</Text>
    </View>
  );
}

function LinkRow({
  label,
  onPress,
  last,
}: {
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <>
      <TouchableOpacity style={styles.linkRow} onPress={onPress} activeOpacity={0.65}>
        <Text style={styles.linkLabel}>{label}</Text>
        <Text style={styles.linkArrow}>›</Text>
      </TouchableOpacity>
      {!last && <View style={styles.rowDivider} />}
    </>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AboutScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.content}>

      {/* ── Pine header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Wordmark block ── */}
        <View style={styles.wordmarkBlock}>
          <Text style={styles.wordmark}>Cartpath</Text>
          <Text style={styles.tagline}>Golf courses you can reach by train.</Text>
        </View>

        {/* ── Attributions ── */}
        <Text style={styles.sectionLabel}>Attributions</Text>
        <Card>
          <AttributionRow text="Powered by the Transport for London Journey Planner API." />
          <View style={styles.cardDivider} />
          <AttributionRow text="Maps and place information by Google." />
          <View style={styles.cardDivider} />
          <AttributionRow text="Station data: National Rail and Transport for London." />
        </Card>
        <Text style={styles.cardFootnote}>
          Cartpath is not affiliated with, endorsed by, or an official product of Transport for
          London or Google.
        </Text>

        {/* ── Legal ── */}
        <Text style={styles.sectionLabel}>Legal</Text>
        <Card>
          <LinkRow
            label="Privacy policy"
            onPress={() => openLink(PRIVACY_URL)}
            last={!TERMS_URL}
          />
          {!!TERMS_URL && (
            <LinkRow
              label="Terms of use"
              onPress={() => openLink(TERMS_URL)}
              last
            />
          )}
        </Card>

        {/* ── Feedback ── */}
        <Text style={styles.sectionLabel}>Feedback</Text>
        <Card>
          <LinkRow
            label="Email feedback"
            onPress={() => openLink(`mailto:${CONTACT_EMAIL}`)}
            last
          />
        </Card>

        {/* ── Disclaimer ── */}
        <Text style={styles.disclaimer}>
          Journey times and changes are estimates; always check live times before you travel.
          Course access can change — confirm directly with the club.
        </Text>

        {/* ── Version + footer ── */}
        <Text style={styles.version}>Version {version}</Text>
        <Text style={styles.footer}>Made for London &amp; the South East</Text>

      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pine },
  content: { flex: 1, backgroundColor: colors.linen },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pine,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.brass,
    gap: space.sm,
  },
  backBtn: { paddingRight: 4 },
  backText: { fontFamily: font.sans, fontSize: 20, color: colors.linen, lineHeight: 26 },
  headerTitle: {
    fontFamily: font.serif,
    fontSize: 18,
    color: colors.linen,
    letterSpacing: -0.3,
  },

  scrollContent: {
    padding: space.lg,
    paddingBottom: 48,
  },

  wordmarkBlock: {
    alignItems: 'center',
    paddingVertical: space.xl,
  },
  wordmark: {
    fontFamily: font.serif,
    fontSize: 36,
    color: colors.pine,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: font.sans,
    fontSize: 14,
    color: colors.muted,
  },

  sectionLabel: {
    fontFamily: font.sansMed,
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: space.xs,
    marginTop: space.lg,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },

  attrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: 12,
    gap: space.sm,
  },
  attrDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.brass,
    marginTop: 6,
    flexShrink: 0,
  },
  attrText: {
    flex: 1,
    fontFamily: font.sans,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  linkLabel: {
    flex: 1,
    fontFamily: font.sans,
    fontSize: 15,
    color: colors.ink,
  },
  linkArrow: {
    fontFamily: font.sans,
    fontSize: 20,
    color: colors.muted,
    lineHeight: 22,
  },

  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginLeft: space.md + 5 + space.sm, // align with text
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginLeft: space.md,
  },

  cardFootnote: {
    fontFamily: font.sans,
    fontSize: 11,
    color: colors.muted,
    marginTop: space.xs,
    paddingHorizontal: 4,
    lineHeight: 16,
  },

  disclaimer: {
    fontFamily: font.sans,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: space.xl,
    paddingHorizontal: 4,
    textAlign: 'center',
  },

  version: {
    fontFamily: font.sans,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: space.lg,
  },
  footer: {
    fontFamily: font.sans,
    fontSize: 11,
    color: colors.sage,
    textAlign: 'center',
    marginTop: space.xs,
  },
});
