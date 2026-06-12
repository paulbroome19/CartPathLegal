import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, font } from '@/src/theme';

const TRACK_PAD = 4;

interface Props<T extends string> {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = options.findIndex((o) => o.value === value);
  const segWidth = trackWidth > 0 ? (trackWidth - TRACK_PAD * 2) / options.length : 0;

  const pillX = useSharedValue(TRACK_PAD);

  useEffect(() => {
    if (segWidth > 0) {
      pillX.value = withTiming(TRACK_PAD + activeIndex * segWidth, { duration: 150 });
    }
  }, [activeIndex, segWidth, pillX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <View
      style={styles.track}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {trackWidth > 0 && (
        <Animated.View style={[styles.pill, { width: segWidth }, pillStyle]} />
      )}
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={styles.item}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.8}
        >
          <Text style={[styles.label, value === opt.value && styles.labelActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.stone,
    borderRadius: 12,
    padding: TRACK_PAD,
  },
  pill: {
    position: 'absolute',
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    left: 0,
    borderRadius: 9,
    backgroundColor: colors.brass,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  label: {
    fontFamily: font.sans,
    fontSize: 12,
    color: colors.muted,
  },
  labelActive: {
    fontFamily: font.sansBold,
    color: colors.brassText,
  },
});
