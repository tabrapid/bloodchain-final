import { apiRequest } from './client';
import { apiBasePath } from './config';

export interface TestType {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  isActive: boolean;
  parameters: TestParameter[];
}

export interface TestParameter {
  id: string;
  code: string;
  name: string;
  unit?: string;
  dataType: string;
}

export interface Laboratory {
  id: string;
  name: string;
  address?: string;
  laboratoryProfile?: {
    id: string;
    name: string;
    isActive: boolean;
    testTypes: Array<{ id: string; code: string; name: string; category: string }>;
  };
}

export interface AppointmentSlot {
  id: string;
  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
  status: string;
  isAvailable?: boolean;
}

export interface LaboratoryAppointment {
  id: string;
  referenceNumber: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  notes?: string;
  organization: {
    id: string;
    name: string;
    address?: string;
  };
  /** The panel the donor booked, carried from the booking request. */
  testType?: {
    id: string;
    code: string;
    name: string;
    category: string;
  };
  laboratoryResult?: {
    id: string;
    status: string;
    publishedAt?: string;
  };
}

export interface LaboratoryResult {
  id: string;
  status: string;
  publishedAt?: string;
  testType: {
    id: string;
    code: string;
    name: string;
    category: string;
  };
  laboratory: {
    id: string;
    name: string;
    address?: string;
  };
  items: LaboratoryResultItem[];
}

export interface LaboratoryResultItem {
  id: string;
  value?: string;
  numericValue?: number;
  unit?: string;
  referenceMin?: number;
  referenceMax?: number;
  flag: string;
  parameter: TestParameter;
}

export interface ParameterTrend {
  value: string;
  numericValue: number | null;
  unit: string | null;
  flag: string;
  date: string;
  laboratory: string;
}

export async function getTestTypes(category?: string): Promise<TestType[]> {
  const params = category ? `?category=${category}` : '';
  return apiRequest<TestType[]>(`${apiBasePath}/test-types${params}`);
}

export async function getTestType(testTypeId: string): Promise<TestType> {
  return apiRequest<TestType>(`${apiBasePath}/test-types/${testTypeId}`);
}

export async function getLaboratories(): Promise<Laboratory[]> {
  return apiRequest<Laboratory[]>(`${apiBasePath}/laboratories`);
}

export async function getLaboratory(laboratoryId: string): Promise<Laboratory> {
  return apiRequest<Laboratory>(`${apiBasePath}/laboratories/${laboratoryId}`);
}

export async function getAvailableSlots(
  laboratoryId: string,
  testTypeId: string,
  date: string
): Promise<AppointmentSlot[]> {
  return apiRequest<AppointmentSlot[]>(
    `${apiBasePath}/laboratories/${laboratoryId}/slots?testTypeId=${testTypeId}&date=${date}`
  );
}

export async function bookLaboratoryAppointment(data: {
  laboratoryId: string;
  testTypeId: string;
  slotId: string;
  notes?: string;
}): Promise<LaboratoryAppointment> {
  return apiRequest<LaboratoryAppointment>(`${apiBasePath}/laboratory-appointments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getDonorAppointments(filters?: {
  status?: string;
  laboratoryId?: string;
}): Promise<LaboratoryAppointment[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.laboratoryId) params.append('laboratoryId', filters.laboratoryId);
  const queryString = params.toString();
  return apiRequest<LaboratoryAppointment[]>(
    `${apiBasePath}/me/laboratory-appointments${queryString ? `?${queryString}` : ''}`
  );
}

export async function getDonorAppointment(appointmentId: string): Promise<LaboratoryAppointment> {
  return apiRequest<LaboratoryAppointment>(`${apiBasePath}/me/laboratory-appointments/${appointmentId}`);
}

export async function cancelDonorAppointment(
  appointmentId: string,
  reason?: string
): Promise<LaboratoryAppointment> {
  return apiRequest<LaboratoryAppointment>(
    `${apiBasePath}/me/laboratory-appointments/${appointmentId}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
}

export async function getDonorResults(filters?: {
  testTypeId?: string;
}): Promise<LaboratoryResult[]> {
  const params = new URLSearchParams();
  if (filters?.testTypeId) params.append('testTypeId', filters.testTypeId);
  const queryString = params.toString();
  return apiRequest<LaboratoryResult[]>(
    `${apiBasePath}/me/laboratory-results${queryString ? `?${queryString}` : ''}`
  );
}

export async function getDonorResult(resultId: string): Promise<LaboratoryResult> {
  return apiRequest<LaboratoryResult>(`${apiBasePath}/me/laboratory-results/${resultId}`);
}

export async function getParameterTrend(
  parameterId: string,
  options?: { limit?: number }
): Promise<ParameterTrend[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', String(options.limit));
  const queryString = params.toString();
  return apiRequest<ParameterTrend[]>(
    `${apiBasePath}/me/laboratory-results/parameter/${parameterId}/trend${queryString ? `?${queryString}` : ''}`
  );
}
