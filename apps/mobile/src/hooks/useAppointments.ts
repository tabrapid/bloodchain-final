import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAvailability,
  getOrganizations,
  getMyAppointments,
  getNextAppointment,
  getAppointment,
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  type AppointmentSlot,
  type Appointment,
  type BookAppointmentInput,
  type CancelAppointmentInput,
  type RescheduleAppointmentInput,
} from '../api/appointments';

export function useAvailability(params?: {
  organizationId?: string;
  appointmentType?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery<AppointmentSlot[]>({
    queryKey: ['availability', params],
    queryFn: () => getAvailability(params),
  });
}

export function useOrganizations(params?: { type?: string }) {
  return useQuery<Array<{ id: string; type: string; name: string; address?: string }>>({
    queryKey: ['organizations', params],
    queryFn: () => getOrganizations(params),
  });
}

export function useMyAppointments(params?: {
  status?: string;
  appointmentType?: string;
  upcoming?: boolean;
  past?: boolean;
  date?: string;
}) {
  return useQuery<Appointment[]>({
    queryKey: ['my-appointments', params],
    queryFn: () => getMyAppointments(params),
  });
}

export function useNextAppointment() {
  return useQuery<Appointment | null>({
    queryKey: ['next-appointment'],
    queryFn: getNextAppointment,
  });
}

export function useAppointment(id: string) {
  return useQuery<Appointment>({
    queryKey: ['appointment', id],
    queryFn: () => getAppointment(id),
    enabled: !!id,
  });
}

export function useBookAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BookAppointmentInput) => bookAppointment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: CancelAppointmentInput }) =>
      cancelAppointment(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
    },
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RescheduleAppointmentInput }) =>
      rescheduleAppointment(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['next-appointment'] });
    },
  });
}