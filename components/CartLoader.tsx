import { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/src/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const TICK_COUNT = 5;
const TICK_W = 3;
const TICK_H = 18;
const SPREAD = SCREEN_W * 0.55;

export default function CartLoader() {
  const logoY = useSharedValue(0);
  const tickX = useSharedValue(0);
  const tickOpacity = useSharedValue(0);

  useEffect(() => {
    // Logo bob: gentle up-down loop
    logoY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    // Tick swish: slide across and fade
    tickX.value = withRepeat(
      withTiming(SPREAD, { duration: 900, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    tickOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(1, { duration: 500 }),
        withTiming(0, { duration: 200 }),
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
      <View style={styles.inner}>
        <Animated.View style={logoStyle}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>
        <View style={styles.tickRow}>
          {Array.from({ length: TICK_COUNT }).map((_, i) => (
            <TickMark key={i} index={i} tickX={tickX} tickOpacity={tickOpacity} />
          ))}
        </View>
      </View>
    </View>
  );
}

function TickMark({
  index,
  tickX,
  tickOpacity,
}: {
  index: number;
  tickX: SharedValue<number>;
  tickOpacity: SharedValue<number>;
}) {
  const offset = (index / (TICK_COUNT - 1)) * SPREAD - SPREAD / 2;

  const style = useAnimatedStyle(() => ({
    opacity: tickOpacity.value * (1 - Math.abs(index - (TICK_COUNT - 1) / 2) / TICK_COUNT),
    transform: [{ translateX: tickX.value + offset - SPREAD / 2 }],
  }));

  return <Animated.View style={[styles.tick, style]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    gap: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
  tickRow: {
    flexDirection: 'row',
    width: SPREAD,
    justifyContent: 'center',
    height: TICK_H,
    overflow: 'hidden',
  },
  tick: {
    position: 'absolute',
    width: TICK_W,
    height: TICK_H,
    borderRadius: TICK_W / 2,
    backgroundColor: colors.brass,
  },
});
