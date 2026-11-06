/** Allowlisted HTTP logs: query strings can contain live verification tokens. */
export function serializeHttpRequest(request: { id?: unknown; method?: string; url?: string }) {
  return {
    id: request.id,
    method: request.method,
    url: (request.url ?? '').split('?')[0],
  };
}

export function serializeHttpResponse(response: { statusCode?: number }) {
  return { statusCode: response.statusCode };
}
