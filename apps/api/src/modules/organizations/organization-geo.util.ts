/**
 * Distance on a sphere, and the bounding box that lets the database do most of
 * the work.
 *
 * A precise radius filter needs a great-circle distance per row, which no index
 * can help with. A bounding box is a pair of range predicates the existing
 * latitude/longitude indexes can serve, and it is a superset of the circle --
 * so the box narrows the candidates in the database and the exact distance
 * rejects the corners in memory. For a directory of hundreds of organizations
 * this is the whole of what PostGIS would buy, without the extension.
 */

/** Mean Earth radius, kilometres. */
const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * The smallest latitude/longitude rectangle containing every point within
 * `radiusKm` of the centre.
 *
 * Longitude degrees shrink towards the poles, so the longitude span is divided
 * by cos(latitude). Near a pole that divisor approaches zero and the span
 * exceeds the whole globe; the clamp to [-180, 180] keeps the predicate valid
 * rather than producing an empty range. Uzbekistan is nowhere near a pole, but
 * a helper that returns nonsense at 89° is a helper that will do it eventually.
 */
export function boundingBox(
  centre: { latitude: number; longitude: number },
  radiusKm: number,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const cosLat = Math.cos(toRadians(centre.latitude));
  // Below this the division is numerically meaningless; span the globe instead.
  const lonDelta = Math.abs(cosLat) < 1e-6 ? 180 : latDelta / Math.abs(cosLat);

  return {
    minLat: Math.max(-90, centre.latitude - latDelta),
    maxLat: Math.min(90, centre.latitude + latDelta),
    minLon: Math.max(-180, centre.longitude - Math.min(180, lonDelta)),
    maxLon: Math.min(180, centre.longitude + Math.min(180, lonDelta)),
  };
}
