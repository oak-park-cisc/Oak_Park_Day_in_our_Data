/**
 * API boundary aligned with docs/backend-spec.md. Set VITE_API_BASE when the
 * service is deployed; until then the UI operates against the local demo store.
 */
const apiBase = import.meta.env.VITE_API_BASE as string | undefined;

export type LocalDate = `${number}-${number}-${number}`;
export type SignatureState = 'counted' | 'duplicate_address' | 'off_block' | 'struck';
export type DateChecks = {
  petition_due: LocalDate;
  due_passed: boolean;
  season: { ok: boolean; problems: string[] };
  block_year_count: number;
  max_per_block_per_year: number;
};
export type RequestInput = {
  block_id: string;
  date_start: LocalDate;
  date_end: LocalDate;
  guests: number;
  services: { barricades: boolean; green_kit: boolean };
};

/**
 * Mocked sign-in for the demo: the API's dev auth accepts these fixed tokens (see api/README.md).
 * The role comes from the endpoint being called. Replace with the real identity service later.
 */
const env = import.meta.env;
const mockTokens = {
  resident: (env.VITE_DEV_TOKEN_RESIDENT as string | undefined) ?? 'dev-resident-a',
  vendor: (env.VITE_DEV_TOKEN_VENDOR as string | undefined) ?? 'dev-vendor-icecream',
  village: (env.VITE_DEV_TOKEN_VILLAGE as string | undefined) ?? 'dev-reviewer'
};
function mockTokenFor(path: string) {
  if (path.startsWith('/vendor')) return mockTokens.vendor;
  if (path.startsWith('/village') || path.startsWith('/ai/')) return mockTokens.village;
  return mockTokens.resident;
}

/** Error thrown for non-2xx responses; `code` is the API's machine-readable error code. */
export class ApiFailure extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

export type ApiRole = 'resident' | 'vendor' | 'village';

export async function request<T>(path: string, init?: RequestInit, role?: ApiRole): Promise<T> {
  if (!apiBase) throw new Error('API is not configured');
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${role ? mockTokens[role] : mockTokenFor(path)}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const fallback = `Request failed (${response.status})`;
    let failure = new ApiFailure(fallback, response.status);
    try {
      const error = await response.json() as { code?: string; message?: string; reasons?: string[] };
      const message = [error.message, ...(error.reasons ?? [])].filter(Boolean).join(' ');
      failure = new ApiFailure(message || fallback, response.status, error.code);
    } catch { /* body was not JSON; keep the generic message */ }
    throw failure;
  }
  return response.json() as Promise<T>;
}

export const endpoint = {
  rules: '/rules?year=2027',
  lookup: (address: string) => `/blocks/lookup?address=${encodeURIComponent(address)}`,
  createRequest: '/requests',
  createPetition: (id: string) => `/requests/${id}/petition`,
  residentRequests: '/me/requests',
  vendorOffer: '/vendor/offer',
  vendorMatches: '/vendor/matches?state=proposed',
  villageRequests: '/village/requests?sort=submitted_at',
  villageToday: (date: string) => `/village/day?date=${date}`
};

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `bpib-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type CallOptions = { role?: ApiRole; headers?: Record<string, string> };

function send<T>(method: 'POST' | 'PUT', path: string, body?: unknown, options: CallOptions = {}) {
  return request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Idempotency-Key': idempotencyKey(), ...(options.headers ?? {}) }
  }, options.role);
}
function post<T>(path: string, body?: unknown, options?: CallOptions) { return send<T>('POST', path, body, options); }
function put<T>(path: string, body?: unknown, options?: CallOptions) { return send<T>('PUT', path, body, options); }

export type Reason = { pts: number; text: string };
export type ChangeRequestInput = { type: 'reschedule' | 'cancel'; proposed_start?: LocalDate; proposed_end?: LocalDate; message: string };
export type OfferInput = {
  service: string; price_usd: number; max_guests: number; jobs_per_day: number; includes: string;
  days: string[]; zips: string[]; active: boolean;
};
export type ThreadMessages = { thread: Record<string, unknown>; messages: Record<string, unknown>[] };
export type WhatIfBody = { date: LocalDate; closures: string[]; treat_as_weekday: boolean };
export type AiExplainInput = {
  question: string; date: string; is_weekday: boolean;
  closures: { label: string; score: number; level: string; reasons: Reason[] }[];
  weekend: { count: number; cap: number } | null;
  suggestions: { text: string }[]; tips: string[];
};
export type AiExplainOutput = { summary: string; answer: string; referenced_suggestions: number[]; source: 'ai' | 'template'; label: string };

/** Resident calls defined in docs/api/resident.openapi.yaml. Browser-only client; not a backend. */
export type PublicPetition = { block_label: string; date_start: string; date_end: string; hours: string; barricades: boolean; organizer_display_name: string; distinct_count: number; needed: number; open: boolean };

export const publicApi = {
  getPetition: (token: string) => request<PublicPetition>(`/petitions/${encodeURIComponent(token)}`)
};

export const residentApi = {
  getRules: (year = 2027) => request<unknown>(`/rules?year=${year}`),
  lookupBlock: (address: string) => request<unknown>(endpoint.lookup(address)),
  dateChecks: (input: Pick<RequestInput, 'block_id' | 'date_start' | 'date_end'>) => post<DateChecks>('/checks/dates', input),
  createRequest: (input: RequestInput) => post<unknown>('/requests', input),
  getRequest: (requestId: string) => request<unknown>(`/requests/${encodeURIComponent(requestId)}`),
  signatures: (requestId: string) => request<unknown>(`/requests/${encodeURIComponent(requestId)}/signatures`),
  beginPetition: (requestId: string) => post<{ petition_url: string; petition_due: LocalDate }>(`/requests/${requestId}/petition`),
  signPetition: (token: string, input: { name: string; house_number: string; email?: string; consent: true; captcha: string }) => post<{ state: SignatureState; distinct_count: number; needed: number }>(`/petitions/${encodeURIComponent(token)}/signatures`, input),
  submitRequest: (requestId: string) => post<unknown>(`/requests/${requestId}/submit`),
  withdrawRequest: (requestId: string) => post<unknown>(`/requests/${requestId}/withdraw`),
  changeRequest: (requestId: string, input: ChangeRequestInput) => post<unknown>(`/requests/${requestId}/change-requests`, input),
  myRequests: () => request<{ requests?: unknown[] }>('/me/requests').then((d) => d.requests ?? [])
};

export const vendorApi = {
  me: () => request<unknown>('/vendor/me'),
  offer: () => request<unknown>('/vendor/offer'),
  saveOffer: (input: OfferInput) => put<unknown>('/vendor/offer', input),
  summary: () => request<unknown>('/vendor/summary'),
  matches: () => request<{ matches?: unknown[] }>('/vendor/matches?state=proposed').then((d) => d.matches ?? []),
  accept: (matchId: string) => post<unknown>(`/vendor/matches/${encodeURIComponent(matchId)}/accept`),
  decline: (matchId: string) => post<unknown>(`/vendor/matches/${encodeURIComponent(matchId)}/decline`),
  undo: (matchId: string) => post<unknown>(`/vendor/matches/${encodeURIComponent(matchId)}/undo`),
  jobs: () => request<{ jobs?: Record<string, unknown>[] }>('/vendor/jobs').then((d) => (d.jobs ?? []).map((job) => ({ event_date: job.date, ...job }))),
  withdrawJob: (matchId: string, reason: string) => post<unknown>(`/vendor/jobs/${encodeURIComponent(matchId)}/withdraw`, { reason }),
  messages: (threadId: string) => request<ThreadMessages>(`/threads/${encodeURIComponent(threadId)}/messages`, undefined, 'vendor'),
  sendMessage: (threadId: string, body: string) => post<unknown>(`/threads/${encodeURIComponent(threadId)}/messages`, { body }, { role: 'vendor' })
};

export const villageApi = {
  requests: (status?: string) => request<{ items?: unknown[]; facets?: Record<string, number> }>(`/village/requests?sort=submitted_at${status ? `&status=${encodeURIComponent(status)}` : ''}`).then((d) => ({ ...d, requests: d.items ?? [] })),
  request: (id: string) => request<unknown>(`/village/requests/${encodeURIComponent(id)}`),
  approve: (id: string, date: string, version: string) => post<unknown>(`/village/requests/${encodeURIComponent(id)}/approve`, { date }, { headers: { 'If-Match': version } }),
  reject: (id: string, reason: string) => post<unknown>(`/village/requests/${encodeURIComponent(id)}/reject`, { reason }),
  resolveChange: (id: string, decision: 'accept' | 'decline', newDate?: string, message?: string) => post<unknown>(`/village/change-requests/${encodeURIComponent(id)}/resolve`, { decision, ...(newDate ? { new_date: newDate } : {}), ...(message ? { message } : {}) }),
  today: (date: string) => request<unknown>(`/village/day?date=${encodeURIComponent(date)}`),
  whatIf: (date: LocalDate, closures: string[], treatAsWeekday = false) => post<unknown>('/village/whatif', { date, closures, treat_as_weekday: treatAsWeekday } satisfies WhatIfBody),
  explain: (input: AiExplainInput) => post<AiExplainOutput>('/ai/explain', input),
  messages: (threadId: string) => request<ThreadMessages>(`/threads/${encodeURIComponent(threadId)}/messages`, undefined, 'village'),
  sendMessage: (threadId: string, body: string) => post<unknown>(`/threads/${encodeURIComponent(threadId)}/messages`, { body }, { role: 'village' })
};

export const apiConfigured = Boolean(apiBase);
