import { Injectable, Logger } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { ShipmentStateMachine } from './shipment-state.service';

interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

interface SanityCheckResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

interface LocationWithTimestamp {
  latitude: number;
  longitude: number;
  recordedAt: Date;
}

const EARTH_RADIUS_KM = 6371;
const MAX_SPEED_KMH = 200;
const MIN_ACCURACY_METERS = 0;
const MAX_ACCURACY_METERS = 1000;
const MAX_LOCATION_AGE_HOURS = 24;
const MAX_IMPOSSIBLE_JUMP_KM = 100;

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(private readonly db: PrismaService) {}

  async validateLocationUpdate(
    courierId: string,
    shipmentId: string,
    update: LocationUpdate,
  ): Promise<SanityCheckResult> {
    const result: SanityCheckResult = {
      isValid: true,
      warnings: [],
      errors: [],
    };

    if (update.latitude < -90 || update.latitude > 90) {
      result.errors.push('Latitude out of valid range (-90 to 90)');
      result.isValid = false;
    }

    if (update.longitude < -180 || update.longitude > 180) {
      result.errors.push('Longitude out of valid range (-180 to 180)');
      result.isValid = false;
    }

    if (update.accuracy !== undefined) {
      if (update.accuracy < MIN_ACCURACY_METERS) {
        result.warnings.push('Accuracy suspiciously high (0m)');
      }
      if (update.accuracy > MAX_ACCURACY_METERS) {
        result.warnings.push(`Accuracy very low: ${update.accuracy}m`);
      }
    }

    if (update.speed !== undefined && update.speed > MAX_SPEED_KMH) {
      result.warnings.push(`Unreasonably high speed: ${update.speed} km/h`);
    }

    const previousLocation = await this.getLastLocation(shipmentId);
    if (previousLocation) {
      const distance = this.calculateDistance(
        previousLocation.latitude,
        previousLocation.longitude,
        update.latitude,
        update.longitude,
      );

      const timeDiffHours = (update.timestamp.getTime() - previousLocation.recordedAt.getTime()) / (1000 * 60 * 60);

      if (timeDiffHours > 0) {
        const impliedSpeed = distance / timeDiffHours;
        if (impliedSpeed > MAX_SPEED_KMH) {
          result.warnings.push(`Implied speed between updates is ${impliedSpeed.toFixed(1)} km/h (max: ${MAX_SPEED_KMH} km/h)`);
        }
      }

      if (distance > MAX_IMPOSSIBLE_JUMP_KM) {
        result.errors.push(`Impossible location jump: ${distance.toFixed(1)} km in ${timeDiffHours.toFixed(2)} hours`);
        result.isValid = false;
      }
    }

    const now = new Date();
    const locationAge = (now.getTime() - update.timestamp.getTime()) / (1000 * 60 * 60);
    if (locationAge > MAX_LOCATION_AGE_HOURS) {
      result.errors.push(`Location timestamp is ${locationAge.toFixed(1)} hours old`);
      result.isValid = false;
    }

    if (update.timestamp.getTime() > now.getTime() + 5 * 60 * 1000) {
      result.errors.push('Location timestamp is in the future');
      result.isValid = false;
    }

    return result;
  }

  async validateCourierShipmentAccess(
    courierId: string,
    shipmentId: string,
  ): Promise<{ valid: boolean; shipment?: any; courier?: any; error?: string }> {
    const courier = await this.db.courier.findUnique({
      where: { id: courierId },
      include: { user: true },
    });

    if (!courier) {
      return { valid: false, error: 'Courier not found' };
    }

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return { valid: false, error: 'Shipment not found' };
    }

    if (shipment.courierId !== courierId) {
      return { valid: false, error: 'Shipment is not assigned to this courier' };
    }

    if (!ShipmentStateMachine.isLocationTrackable(shipment.status as ShipmentStatus)) {
      return { valid: false, error: `Location tracking is not allowed for shipment in ${shipment.status} state` };
    }

    return { valid: true, shipment, courier };
  }

  async canUpdateLocation(shipmentId: string): Promise<boolean> {
    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      select: { status: true, courierId: true },
    });

    if (!shipment) {
      return false;
    }

    return ShipmentStateMachine.isLocationTrackable(shipment.status as ShipmentStatus);
  }

  async getLastLocation(shipmentId: string): Promise<LocationWithTimestamp | null> {
    const location = await this.db.shipmentLocation.findFirst({
      where: { shipmentId },
      orderBy: { recordedAt: 'desc' },
      select: {
        latitude: true,
        longitude: true,
        recordedAt: true,
      },
    });

    if (!location) {
      return null;
    }

    return {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      recordedAt: location.recordedAt,
    };
  }

  async getLocationHistory(
    shipmentId: string,
    limit = 100,
    offset = 0,
  ): Promise<LocationWithTimestamp[]> {
    const locations = await this.db.shipmentLocation.findMany({
      where: { shipmentId },
      orderBy: { recordedAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        latitude: true,
        longitude: true,
        recordedAt: true,
      },
    });

    return locations.map((loc) => ({
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
      recordedAt: loc.recordedAt,
    }));
  }

  async cleanupOldLocations(shipmentId: string, retentionDays = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.shipmentLocation.deleteMany({
      where: {
        shipmentId,
        recordedAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  calculateStraightLineEta(
    currentLat: number,
    currentLon: number,
    destLat: number,
    destLon: number,
    avgSpeedKmh = 40,
  ): { distanceKm: number; etaMinutes: number } {
    const distanceKm = this.calculateDistance(currentLat, currentLon, destLat, destLon);
    const etaMinutes = Math.round((distanceKm / avgSpeedKmh) * 60);

    return { distanceKm, etaMinutes };
  }
}
