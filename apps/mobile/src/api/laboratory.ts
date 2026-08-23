import { apiRequest } from './client';

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
  const response = await apiRequest<{ data: TestType[] }>(`/test-types${params}`);
  return response.data;
}

export async function getTestType(testTypeId: string): Promise<TestType> {
  const response = await apiRequest<{ data: TestType }>(`/test-types/${testTypeId}`);
  return response.data;
}

export async function getLaboratories(): Promise<Laboratory[]> {
  const response = await apiRequest<{ data: Laboratory[] }>('/laboratories');
  return response.data;
}

export async function getLaboratory(laboratoryId: string): Promise<Laboratory> {
  const response = await apiRequest<{ data: Laboratory }>(`/laboratories/${laboratoryId}`);
  return response.data;
}

export async function getAvailableSlots(
  laboratoryId: string,
  testTypeId: string,
  date: string
): Promise<AppointmentSlot[]> {
  const response = await apiRequest<{ data: AppointmentSlot[] }>(
    `/laboratories/${laboratoryId}/slots?testTypeId=${testTypeId}&date=${date}`
  );
  return response.data;
}

export async function bookLaboratoryAppointment(data: {
  laboratoryId: string;
  testTypeId: string;
  slotId: string;
  notes?: string;
}): Promise<LaboratoryAppointment> {
  const response = await apiRequest<{ data: LaboratoryAppointment }>('/laboratory-appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function getDonorAppointments(filters?: {
  status?: string;
  laboratoryId?: string;
}): Promise<LaboratoryAppointment[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.laboratoryId) params.append('laboratoryId', filters.laboratoryId);
  const queryString = params.toString();
  const response = await apiRequest<{ data: LaboratoryAppointment[] }>(
    `/me/laboratory-appointments${queryString ? `?${queryString}` : ''}`
  );
  return response.data;
}

export async function getDonorAppointment(appointmentId: string): Promise<LaboratoryAppointment> {
  const response = await apiRequest<{ data: LaboratoryAppointment }>(
    `/me/laboratory-appointments/${appointmentId}`
  );
  return response.data;
}

export async function cancelDonorAppointment(
  appointmentId: string,
  reason?: string
): Promise<LaboratoryAppointment> {
  const response = await apiRequest<{ data: LaboratoryAppointment }>(
    `/me/laboratory-appointments/${appointmentId}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
  return response.data;
}

export async function getDonorResults(filters?: {
  testTypeId?: string;
}): Promise<LaboratoryResult[]> {
  const params = new URLSearchParams();
  if (filters?.testTypeId) params.append('testTypeId', filters.testTypeId);
  const queryString = params.toString();
  const response = await apiRequest<{ data: LaboratoryResult[] }>(
    `/me/laboratory-results${queryString ? `?${queryString}` : ''}`
  );
  return response.data;
}

export async function getDonorResult(resultId: string): Promise<LaboratoryResult> {
  const response = await apiRequest<{ data: LaboratoryResult }>(`/me/laboratory-results/${resultId}`);
  return response.data;
}

export async function getParameterTrend(
  parameterId: string,
  options?: { limit?: number }
): Promise<ParameterTrend[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', String(options.limit));
  const queryString = params.toString();
  const response = await apiRequest<{ data: ParameterTrend[] }>(
    `/me/laboratory-results/parameter/${parameterId}/trend${queryString ? `?${queryString}` : ''}`
  );
  return response.data;
}
