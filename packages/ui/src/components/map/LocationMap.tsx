'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '../cn';
import { colors } from '../../tokens';
import { useOptionalTranslation } from '../../i18n';

export type MapMarkerVariant = 'origin' | 'destination' | 'courier' | 'donor' | 'hospital';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  sublabel?: string;
  variant: MapMarkerVariant;
}

export interface LocationMapProps {
  markers: MapMarker[];
  /** Draws a line connecting markers in array order (e.g. courier -> destination). */
  showRoute?: boolean;
  height?: number | string;
  className?: string;
}

const VARIANT_COLOR: Record<MapMarkerVariant, string> = {
  origin: colors.textMuted,
  destination: colors.success,
  courier: colors.secondary,
  donor: colors.primary,
  hospital: colors.success,
};

function markerIcon(variant: MapMarkerVariant): L.DivIcon {
  const color = VARIANT_COLOR[variant];
  return L.divIcon({
    className: '',
    html: `<span style="
      display: block;
      width: 16px;
      height: 16px;
      border-radius: 9999px;
      background: ${color};
      border: 2px solid ${colors.surface};
      box-shadow: 0 0 0 2px ${color}55;
    "></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function FitToMarkers({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1 && markers[0]) {
      map.setView([markers[0].latitude, markers[0].longitude], 13);
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.latitude, m.longitude]));
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  }, [map, markers]);

  return null;
}

/**
 * Renders live coordinates as an actual map instead of raw lat/lng text.
 * Uses OpenStreetMap tiles (via CARTO's free dark basemap, no API key) --
 * fine for development/demo traffic; a production deployment should move
 * to a dedicated tile provider or self-hosted tiles per OSM's tile usage
 * policy before scaling up request volume.
 */
export function LocationMap({ markers, showRoute = false, height = 320, className }: LocationMapProps) {
  const { t } = useOptionalTranslation();
  const center = useMemo<[number, number]>(() => {
    const first = markers[0];
    return first ? [first.latitude, first.longitude] : [0, 0];
  }, [markers]);

  if (markers.length === 0) {
    return (
      <div
        className={cn('bc-glass flex items-center justify-center rounded-card text-sm text-donor-muted', className)}
        style={{ height }}
      >
        {t('common.noLocationData')}
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-card border border-donor-border/60', className)} style={{ height }}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitToMarkers markers={markers} />
        {showRoute && markers.length > 1 && (
          <Polyline
            positions={markers.map((m) => [m.latitude, m.longitude])}
            pathOptions={{ color: colors.textMuted, weight: 2, dashArray: '6 6' }}
          />
        )}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.latitude, marker.longitude]}
            icon={markerIcon(marker.variant)}
          >
            <Popup>
              <strong>{marker.label}</strong>
              {marker.sublabel && (
                <>
                  <br />
                  {marker.sublabel}
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
