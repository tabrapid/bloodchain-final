import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { Text, radius, useDesign } from '../../design';
import { useTranslation } from '../../i18n';

// Deliberately NOT re-exported through '../index' or the design system's
// barrel - react-native-maps links a native module that Expo Go doesn't ship,
// so importing it from a shared barrel would crash every screen (map or not)
// the moment the app boots without a dev client. Import this file directly.

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
 * Live coordinates as an actual map instead of raw lat/lng text.
 *
 * It draws points and nothing else. It used to take `showRoute`, which
 * connected the markers in array order with a dashed line -- pickup, courier,
 * hospital -- and that line is not a route: nothing in this system computes
 * one, and a straight line between two points in a city is not the way anyone
 * will travel. On an emergency screen and on a delivery screen alike it was
 * read as one, so the prop is gone rather than merely unused. A component
 * that cannot draw the line cannot have it reintroduced by a later caller.
 *
 * Uses react-native-maps, which needs a dev client or an EAS build to run --
 * it is not available inside Expo Go.
 */
export function LocationMap({ markers, height = 220 }: LocationMapProps) {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const variantColor: Record<MapMarkerVariant, string> = useMemo(
    () => ({
      origin: colors.textTertiary,
      destination: colors.success.base,
      courier: colors.clinical.base,
      donor: colors.rose.base,
      hospital: colors.success.base,
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
      <View
        style={{
          height,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="caption" tone="tertiary">
          {t('common.noLocationData')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        height,
        borderRadius: radius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.divider,
      }}
    >
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(markers)}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.label}
            description={marker.sublabel}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: colors.surface,
                backgroundColor: variantColor[marker.variant],
              }}
            />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
