import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { AppText } from '../AppText';
import { radius, useTheme, ThemeColors } from '../../theme';
import { useTranslation } from '../../i18n';

// Deliberately NOT re-exported through '../index' - react-native-maps links a
// native module that Expo Go doesn't ship, so importing it anywhere in the
// shared component barrel would crash every screen (map or not) the moment
// the app boots without a dev client. Import this file directly instead.

export type MapMarkerVariant = 'origin' | 'destination' | 'courier' | 'donor' | 'hospital';

export interface MapMarkerPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  sublabel?: string;
  variant: MapMarkerVariant;
}

export interface LocationMapProps {
  markers: MapMarkerPoint[];
  /** Draws a dashed line connecting markers in array order. */
  showRoute?: boolean;
  height?: number;
}

function regionFor(markers: MapMarkerPoint[]): Region {
  const lats = markers.map((m) => m.latitude);
  const lngs = markers.map((m) => m.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // A single marker gets a tight, roughly-neighborhood-scale zoom; multiple
  // markers get padded bounds around the spread (fitToCoordinates below then
  // takes over for the exact final framing once the map has mounted).
  const latDelta = markers.length > 1 ? Math.max((maxLat - minLat) * 1.6, 0.02) : 0.02;
  const lngDelta = markers.length > 1 ? Math.max((maxLng - minLng) * 1.6, 0.02) : 0.02;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

/**
 * Renders live coordinates as an actual map instead of raw lat/lng text -
 * the mobile counterpart of packages/ui's web LocationMap (same marker
 * variants/colors). Uses react-native-maps, which needs a dev client or EAS
 * build to run - it is not available inside Expo Go.
 */
export function LocationMap({ markers, showRoute = false, height = 220 }: LocationMapProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const variantColor: Record<MapMarkerVariant, string> = useMemo(
    () => ({
      origin: colors.textMuted,
      destination: colors.success,
      courier: colors.secondary,
      donor: colors.primary,
      hospital: colors.success,
    }),
    [colors],
  );
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (markers.length < 2) return;
    mapRef.current?.fitToCoordinates(
      markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
      { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true },
    );
  }, [markers]);

  if (markers.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <AppText style={{ color: colors.textMuted }}>{t('common.noLocationData')}</AppText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFillObject}
        initialRegion={regionFor(markers)}
      >
        {showRoute && markers.length > 1 && (
          <Polyline
            coordinates={markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude }))}
            strokeColor={colors.textMuted}
            strokeWidth={2}
            lineDashPattern={[6, 6]}
          />
        )}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.label}
            description={marker.sublabel}
          >
            <View style={[styles.dot, { backgroundColor: variantColor[marker.variant] }]} />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    empty: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSolid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.surfaceSolid,
    },
  });
}
