const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const API_BASE_PATH = '/api/v1';

interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message);
  }
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('donor_access_token');
}

export interface TestType {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  isActive: boolean;
  displayOrder: number;
  parameters: TestParameter[];
}

export interface TestParameter {
  id: string;
  code: string;
  name: string;
  description?: string;
  unit?: string;
  dataType: string;
  required: boolean;
  displayOrder: number;
}

export interface LaboratoryOrganization {
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

export interface LaboratoryAppointment {
  id: string;
  referenceNumber: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  notes?: string;
  donor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    donorProfile?: {
      bloodType: string;
      rhFactor: string;
    };
  };
  organization: {
    id: string;
    name: string;
  };
  laboratoryResult?: {
    id: string;
    status: string;
  };
}

export interface LaboratoryResult {
  id: string;
  status: string;
  performedAt?: string;
  reviewedAt?: string;
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
  notes?: string;
  parameter: TestParameter;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    throw new ApiRequestError({
      statusCode: 401,
      code: 'NO_TOKEN',
      message: 'Not authenticated',
    });
  }

  const response = await fetch(`${API_BASE_URL}${API_BASE_PATH}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const json = (await response.json()) as {
    data?: T;
    statusCode?: number;
    message?: string;
  };

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: 'API_ERROR',
      message: json.message ?? 'API request failed',
    });
  }

  return json.data as T;
}

export async function getTestTypes(filters?: {
  category?: string;
  isActive?: boolean;
}): Promise<TestType[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

  const queryString = params.toString();
  return apiRequest<TestType[]>(`/test-types${queryString ? `?${queryString}` : ''}`);
}

export async function getTestType(testTypeId: string): Promise<TestType> {
  return apiRequest<TestType>(`/test-types/${testTypeId}`);
}

export async function getLaboratories(): Promise<LaboratoryOrganization[]> {
  return apiRequest<LaboratoryOrganization[]>('/laboratories');
}

export async function getLaboratory(laboratoryId: string): Promise<LaboratoryOrganization> {
  return apiRequest<LaboratoryOrganization>(`/laboratories/${laboratoryId}`);
}

export async function getLaboratoryAppointments(
  organizationId: string,
  filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }
): Promise<LaboratoryAppointment[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.search) params.append('search', filters.search);

  const queryString = params.toString();
  return apiRequest<LaboratoryAppointment[]>(
    `/organizations/${organizationId}/laboratory-appointments${queryString ? `?${queryString}` : ''}`
  );
}

export async function confirmLaboratoryAppointment(
  organizationId: string,
  appointmentId: string
): Promise<LaboratoryAppointment> {
  return apiRequest<LaboratoryAppointment>(
    `/organizations/${organizationId}/laboratory-appointments/${appointmentId}/confirm`,
    { method: 'POST' }
  );
}

export async function checkInLaboratoryAppointment(
  organizationId: string,
  appointmentId: string
): Promise<LaboratoryAppointment> {
  return apiRequest<LaboratoryAppointment>(
    `/organizations/${organizationId}/laboratory-appointments/${appointmentId}/check-in`,
    { method: 'POST' }
  );
}

export async function startLaboratoryTest(
  organizationId: string,
  appointmentId: string
): Promise<LaboratoryAppointment> {
  return apiRequest<LaboratoryAppointment>(
    `/organizations/${organizationId}/laboratory-appointments/${appointmentId}/start`,
    { method: 'POST' }
  );
}

export async function completeLaboratoryAppointment(
  organizationId: string,
  appointmentId: string
): Promise<LaboratoryAppointment> {
  return apiRequest<LaboratoryAppointment>(
    `/organizations/${organizationId}/laboratory-appointments/${appointmentId}/complete`,
    { method: 'POST' }
  );
}

export async function markLaboratoryNoShow(
  organizationId: string,
  appointmentId: string
): Promise<LaboratoryAppointment> {
  return apiRequest<LaboratoryAppointment>(
    `/organizations/${organizationId}/laboratory-appointments/${appointmentId}/no-show`,
    { method: 'POST' }
  );
}

export async function createLaboratoryResult(
  organizationId: string,
  appointmentId: string,
  data: {
    testTypeId: string;
    items: Array<{
      parameterId: string;
      value: string;
      numericValue?: number;
      unit?: string;
      flag?: string;
      notes?: string;
    }>;
  }
): Promise<LaboratoryResult> {
  return apiRequest<LaboratoryResult>(
    `/organizations/${organizationId}/laboratory-results`,
    {
      method: 'POST',
      body: JSON.stringify({ appointmentId, ...data }),
    }
  );
}

export async function getLaboratoryResult(
  organizationId: string,
  resultId: string
): Promise<LaboratoryResult> {
  return apiRequest<LaboratoryResult>(
    `/organizations/${organizationId}/laboratory-results/${resultId}`
  );
}

export async function reviewLaboratoryResult(
  organizationId: string,
  resultId: string
): Promise<LaboratoryResult> {
  return apiRequest<LaboratoryResult>(
    `/organizations/${organizationId}/laboratory-results/${resultId}/review`,
    { method: 'POST' }
  );
}

export async function publishLaboratoryResult(
  organizationId: string,
  resultId: string
): Promise<LaboratoryResult> {
  return apiRequest<LaboratoryResult>(
    `/organizations/${organizationId}/laboratory-results/${resultId}/publish`,
    { method: 'POST' }
  );
}