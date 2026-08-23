import { BadRequestException } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';

type TransitionMap = {
  [K in ShipmentStatus]?: ShipmentStatus[];
};

const SHIPMENT_TRANSITIONS: TransitionMap = {
  [ShipmentStatus.CREATED]: [ShipmentStatus.COURIER_ASSIGNED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.COURIER_ASSIGNED]: [ShipmentStatus.COURIER_ACCEPTED, ShipmentStatus.COURIER_DECLINED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.COURIER_DECLINED]: [ShipmentStatus.COURIER_ASSIGNED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.COURIER_ACCEPTED]: [ShipmentStatus.PICKUP_STARTED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.PICKUP_STARTED]: [ShipmentStatus.PICKED_UP, ShipmentStatus.FAILED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.FAILED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.ARRIVED_AT_HOSPITAL, ShipmentStatus.FAILED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.ARRIVED_AT_HOSPITAL]: [ShipmentStatus.DELIVERED, ShipmentStatus.FAILED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.FAILED]: [ShipmentStatus.COURIER_ASSIGNED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.CANCELLED]: [],
};

const ACTIVE_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.COURIER_ASSIGNED,
  ShipmentStatus.COURIER_ACCEPTED,
  ShipmentStatus.PICKUP_STARTED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED_AT_HOSPITAL,
];

const LOCATION_TRACKABLE_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.COURIER_ACCEPTED,
  ShipmentStatus.PICKUP_STARTED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED_AT_HOSPITAL,
];

export interface TransitionValidation {
  isValid: boolean;
  allowedTransitions: ShipmentStatus[];
  currentStatus: ShipmentStatus;
  attemptedTransition?: ShipmentStatus;
  errorMessage?: string;
}

export class ShipmentStateMachine {
  static validateTransition(
    currentStatus: ShipmentStatus,
    targetStatus: ShipmentStatus,
  ): TransitionValidation {
    const allowedTransitions = SHIPMENT_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(targetStatus)) {
      return {
        isValid: false,
        allowedTransitions,
        currentStatus,
        attemptedTransition: targetStatus,
        errorMessage: `Invalid transition from ${currentStatus} to ${targetStatus}. Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none'}`,
      };
    }

    return {
      isValid: true,
      allowedTransitions,
      currentStatus,
    };
  }

  static assertTransition(currentStatus: ShipmentStatus, targetStatus: ShipmentStatus): void {
    const validation = this.validateTransition(currentStatus, targetStatus);
    if (!validation.isValid) {
      throw new BadRequestException(validation.errorMessage);
    }
  }

  static isActiveStatus(status: ShipmentStatus): boolean {
    return ACTIVE_STATUSES.includes(status);
  }

  static isLocationTrackable(status: ShipmentStatus): boolean {
    return LOCATION_TRACKABLE_STATUSES.includes(status);
  }

  static getActiveStatuses(): ShipmentStatus[] {
    return [...ACTIVE_STATUSES];
  }

  static getLocationTrackableStatuses(): ShipmentStatus[] {
    return [...LOCATION_TRACKABLE_STATUSES];
  }

  static getAllowedTransitions(status: ShipmentStatus): ShipmentStatus[] {
    return SHIPMENT_TRANSITIONS[status] || [];
  }

  static isTerminalStatus(status: ShipmentStatus): boolean {
    return status === ShipmentStatus.DELIVERED || status === ShipmentStatus.CANCELLED;
  }

  static isCourierAssignable(status: ShipmentStatus): boolean {
    return status === ShipmentStatus.CREATED || status === ShipmentStatus.COURIER_DECLINED || status === ShipmentStatus.FAILED;
  }

  static isCancellable(status: ShipmentStatus): boolean {
    return !this.isTerminalStatus(status);
  }

  static requiresCourierAssignment(status: ShipmentStatus): boolean {
    return status === ShipmentStatus.CREATED;
  }

  static needsCourierAction(status: ShipmentStatus): boolean {
    return (
      status === ShipmentStatus.COURIER_ASSIGNED ||
      status === ShipmentStatus.COURIER_ACCEPTED ||
      status === ShipmentStatus.PICKUP_STARTED ||
      status === ShipmentStatus.PICKED_UP ||
      status === ShipmentStatus.IN_TRANSIT ||
      status === ShipmentStatus.ARRIVED_AT_HOSPITAL
    );
  }
}
