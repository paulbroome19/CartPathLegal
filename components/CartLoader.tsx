import { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/src/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const LINE_W        = 34;
const LINE_H        = 2.5;
const LINE_DURATION = 700;
const STAGGER       = Math.floor(LINE_DURATION / 3); // 233 ms
const LINE_START_X  = -(SCREEN_W / 2 + LINE_W);
const LINE_END_X    =   SCREEN_W / 2 + LINE_W;

// Logo PNG background is #023B2A (sampled); theme pine is #023C2A — 1-channel off,
// causing a ghost rectangle. Use the exact sampled value to blend seamlessly.
const LOADER_BG = '#023B2A';

export default function CartLoader() {
  const logoY = useSharedValue(0);

  useEffect(() => {
    logoY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        withTiming(  0, { duration: 500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoY.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Speed lines — behind logo (rendered first, lower in z-order) */}
      <View style={styles.linesOverlay} pointerEvents="none">
        <SpeedLine delay={0}            yOffset={-12} />
        <SpeedLine delay={STAGGER}      yOffset={  2} />
        <SpeedLine delay={STAGGER * 2}  yOffset={ 16} />
      </View>

      {/* Bobbing logo on top */}
      <Animated.View style={logoStyle}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

// ─── Speed line ───────────────────────────────────────────────────────────────

function SpeedLine({ delay, yOffset }: { delay: number; yOffset: number }) {
  const x       = useSharedValue(LINE_START_X);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Translate left→right behind the cart, instant-reset at end, repeat
    x.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(LINE_END_X, { duration: LINE_DURATION, easing: Easing.out(Easing.quad) }),
          withTiming(LINE_START_X, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );

    // Fade-in → hold → fade-out; total = LINE_DURATION so it syncs with translateX
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.9, { duration: LINE_DURATION * 0.25 }),
          withTiming(0.9, { duration: LINE_DURATION * 0.50 }),
          withTiming(0,   { duration: LINE_DURATION * 0.25 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.speedLine,
        { top: SCREEN_H / 2 + yOffset - LINE_H / 2 },
        style,
      ]}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LOADER_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Full-screen overlay clipped so lines don't bleed outside screen edges
  linesOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  logo: {
    width: 120,
    height: 120,
  },
  speedLine: {
    position: 'absolute',
    left: (SCREEN_W - LINE_W) / 2,
    width: LINE_W,
    height: LINE_H,
    borderRadius: LINE_H / 2,
    backgroundColor: colors.brass,
  },
});
