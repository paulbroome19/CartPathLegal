import { Ionicons } from '@expo/vector-icons';
import { Tabs, useSegments } from 'expo-router';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/src/theme';

const PILL_HEIGHT = 56;
const PILL_WIDTH  = 150;
const PILL_SIDE   = Math.floor((Dimensions.get('window').width - PILL_WIDTH) / 2);

function TabBarBackground() {
  return (
    <View style={[StyleSheet.absoluteFillObject, styles.bgRow]} pointerEvents="none">
      <View style={{ flex: 1 }} />
      <View style={styles.divider} />
      <View style={{ flex: 1 }} />
    </View>
  );
}

export default function TabsLayout() {
  const segments   = useSegments();
  const insets     = useSafeAreaInsets();
  const hideTabBar = (segments as string[]).includes('results');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        },
        tabBarStyle: hideTabBar
          ? ({ display: 'none' } as const)
          : {
              position: 'absolute',
              start: PILL_SIDE,
              end: PILL_SIDE,
              bottom: insets.bottom + 4,
              height: PILL_HEIGHT,
              borderRadius: 28,
              backgroundColor: colors.pine,
              borderTopWidth: 0,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
              elevation: 8,
            },
        tabBarActiveTintColor: colors.brass,
        tabBarInactiveTintColor: colors.linen,
        tabBarBackground: () => <TabBarBackground />,
      }}
    >
      <Tabs.Screen
        name="(search)"
        options={{
          tabBarIcon: ({ color }) => (
            <Ionicons name="search" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color }) => (
            <Ionicons name="map" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bgRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  divider: {
    width: 1,
    marginVertical: 10,
    backgroundColor: colors.brass,
    opacity: 0.6,
  },
});
