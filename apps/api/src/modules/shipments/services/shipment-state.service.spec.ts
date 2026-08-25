import { BadRequestException } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { ShipmentStateMachine } from './shipment-state.service';

describe('ShipmentStateMachine', () => {
  describe('assertTransition', () => {
    it('allows a valid transition without throwing', () => {
      expect(() =>
        ShipmentStateMachine.assertTransition(ShipmentStatus.COURIER_ASSIGNED, ShipmentStatus.COURIER_ACCEPTED),
      ).not.toThrow();
    });

    it('throws BadRequestException for an invalid transition', () => {
      expect(() =>
        ShipmentStateMachine.assertTransition(ShipmentStatus.CREATED, ShipmentStatus.DELIVERED),
      ).toThrow(BadRequestException);
    });

    it('throws for any transition out of a terminal status', () => {
      expect(() =>
        ShipmentStateMachine.assertTransition(ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED),
      ).toThrow(BadRequestException);
      expect(() =>
        ShipmentStateMachine.assertTransition(ShipmentStatus.CANCELLED, ShipmentStatus.COURIER_ASSIGNED),
      ).toThrow(BadRequestException);
    });
  });

  describe('getSourceStatuses', () => {
    it('returns every status whose allowed-transition list includes the target', () => {
      expect(ShipmentStateMachine.getSourceStatuses(ShipmentStatus.COURIER_ACCEPTED)).toEqual([
        ShipmentStatus.COURIER_ASSIGNED,
      ]);

      expect(ShipmentStateMachine.getSourceStatuses(ShipmentStatus.FAILED)).toEqual([
        ShipmentStatus.COURIER_ACCEPTED,
        ShipmentStatus.PICKUP_STARTED,
        ShipmentStatus.PICKED_UP,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.ARRIVED_AT_HOSPITAL,
      ]);
    });

    it('stays in sync with assertTransition: every returned source status actually allows the target', () => {
      for (const status of Object.values(ShipmentStatus)) {
        for (const source of ShipmentStateMachine.getSourceStatuses(status)) {
          expect(() => ShipmentStateMachine.assertTransition(source, status)).not.toThrow();
        }
      }
    });

    it('returns an empty array for a status nothing transitions into implicitly', () => {
      // CREATED is the only initial status; nothing transitions back into it.
      expect(ShipmentStateMachine.getSourceStatuses(ShipmentStatus.CREATED)).toEqual([]);
    });
  });

  describe('isCancellable / isTerminalStatus', () => {
    it('treats DELIVERED and CANCELLED as terminal and not cancellable', () => {
      expect(ShipmentStateMachine.isTerminalStatus(ShipmentStatus.DELIVERED)).toBe(true);
      expect(ShipmentStateMachine.isTerminalStatus(ShipmentStatus.CANCELLED)).toBe(true);
      expect(ShipmentStateMachine.isCancellable(ShipmentStatus.DELIVERED)).toBe(false);
      expect(ShipmentStateMachine.isCancellable(ShipmentStatus.CANCELLED)).toBe(false);
    });

    it('treats every non-terminal status as cancellable, matching getSourceStatuses(CANCELLED)', () => {
      const cancellableSources = ShipmentStateMachine.getSourceStatuses(ShipmentStatus.CANCELLED);
      for (const status of Object.values(ShipmentStatus)) {
        if (status === ShipmentStatus.CANCELLED) continue;
        expect(ShipmentStateMachine.isCancellable(status)).toBe(cancellableSources.includes(status));
      }
    });
  });

  describe('isCourierAssignable', () => {
    it('matches getSourceStatuses(COURIER_ASSIGNED)', () => {
      const assignableSources = ShipmentStateMachine.getSourceStatuses(ShipmentStatus.COURIER_ASSIGNED);
      for (const status of Object.values(ShipmentStatus)) {
        expect(ShipmentStateMachine.isCourierAssignable(status)).toBe(assignableSources.includes(status));
      }
    });
  });
});
