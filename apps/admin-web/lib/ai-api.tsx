const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function getAIPatformAnalytics(days = 30) {
  return authFetch(`/api/v1/admin/ai/analytics?days=${days}`);
}

export async function getAIInsightStats(days = 30) {
  return authFetch(`/api/v1/admin/ai/insight-stats?days=${days}`);
}
