import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  bookLaboratoryAppointment,
  cancelDonorAppointment,
  getAvailableSlots,
  getDonorAppointment,
  getDonorAppointments,
  getDonorResult,
  getDonorResults,
  getLaboratories,
  getTestTypes,
  type AppointmentSlot,
  type Laboratory,
  type LaboratoryAppointment,
  type LaboratoryResult,
  type TestType,
} from '../api/laboratory';

/**
 * The laboratory booking flow's data.
 *
 * `src/api/laboratory.ts` has been complete since the laboratory module
 * shipped, and nothing called it: the Laboratory screen's "Book a blood test"
 * pushed into the *generic* appointment wizard, which has no test-type step and
 * posts to `POST /appointments` -- a DTO with no `testTypeId` field at all. So
 * every test booked from the app reached the blood centre with no panel on it
 * and staff had to ask the donor again. These hooks are what the dedicated
 * flow reads; the generic donation wizard is untouched.
 */
export function useTestTypes(category?: string) {
  return useQuery<TestType[]>({
    queryKey: ['test-types', category ?? null],
    queryFn: () => getTestTypes(category),
  });
}

export function useLaboratories() {
  return useQuery<Laboratory[]>({
    queryKey: ['laboratories'],
    queryFn: getLaboratories,
  });
}

/**
 * Slots at one laboratory for one test type on one day.
 *
 * Disabled until all three are known, because a slot list is meaningless
 * without the test type -- the laboratory offers different panels on different
 * days, and asking for "any slot" would show the donor times they cannot book.
 */
export function useLaboratorySlots(laboratoryId?: string, testTypeId?: string, date?: string) {
  return useQuery<AppointmentSlot[]>({
    queryKey: ['laboratory-slots', laboratoryId, testTypeId, date],
    queryFn: () => getAvailableSlots(laboratoryId!, testTypeId!, date!),
    enabled: Boolean(laboratoryId && testTypeId && date),
  });
}

export function useBookLaboratoryAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bookLaboratoryAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratory-slots'] });
      queryClient.invalidateQueries({ queryKey: ['laboratory-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
    },
  });
}

export function useDonorLaboratoryAppointments(filters?: {
  status?: string;
  laboratoryId?: string;
}) {
  return useQuery<LaboratoryAppointment[]>({
    queryKey: ['laboratory-appointments', filters ?? null],
    queryFn: () => getDonorAppointments(filters),
  });
}

export function useDonorLaboratoryAppointment(appointmentId?: string) {
  return useQuery<LaboratoryAppointment>({
    queryKey: ['laboratory-appointment', appointmentId],
    queryFn: () => getDonorAppointment(appointmentId!),
    enabled: Boolean(appointmentId),
  });
}

export function useCancelLaboratoryAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appointmentId, reason }: { appointmentId: string; reason?: string }) =>
      cancelDonorAppointment(appointmentId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratory-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['laboratory-appointment'] });
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
    },
  });
}

export function useDonorLaboratoryResults(filters?: { testTypeId?: string }) {
  return useQuery<LaboratoryResult[]>({
    queryKey: ['laboratory-results', filters ?? null],
    queryFn: () => getDonorResults(filters),
  });
}

export function useDonorLaboratoryResult(resultId?: string) {
  return useQuery<LaboratoryResult>({
    queryKey: ['laboratory-result', resultId],
    queryFn: () => getDonorResult(resultId!),
    enabled: Boolean(resultId),
  });
}

/**
 * Which laboratories can actually run this panel.
 *
 * `GET /laboratories` returns each laboratory's profile with the test types it
 * offers, so the filtering is the server's data rather than a guess. A
 * laboratory whose profile is inactive, or which does not list the chosen test
 * type, is not offered -- showing it would produce a booking the laboratory
 * cannot honour.
 */
export function laboratoriesOfferingTestType(
  laboratories: Laboratory[],
  testTypeId: string | undefined,
): Laboratory[] {
  if (!testTypeId) return [];
  return laboratories.filter(
    (laboratory) =>
      laboratory.laboratoryProfile?.isActive !== false &&
      (laboratory.laboratoryProfile?.testTypes ?? []).some((type) => type.id === testTypeId),
  );
}
