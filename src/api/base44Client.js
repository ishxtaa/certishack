// FastAPI backend client - replaces base44 SDK
// All requests go through Vite proxy: /api → http://localhost:8000

const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('certis_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token && token !== 'null' && token !== 'undefined') {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(err.detail || 'API error'), { status: res.status, data: err });
  }
  return res.json();
}

function createEntityApi(entity) {
  return {
    list: (sort, limit) => {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', limit);
      const qs = params.toString();
      return apiFetch(`/${entity}${qs ? '?' + qs : ''}`);
    },
    get: (id) => apiFetch(`/${entity}/${id}`),
    create: (data) => apiFetch(`/${entity}`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/${entity}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`/${entity}/${id}`, { method: 'DELETE' }),
  };
}

export const base44 = {
  entities: {
    Incident: createEntityApi('incidents'),
    Officer: createEntityApi('officers'),
    Recommendation: createEntityApi('recommendations'),
  },
  auth: {
    me: () => apiFetch('/auth/me'),
    login: (email, password) =>
      apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => { localStorage.removeItem('certis_token'); },
    redirectToLogin: () => { localStorage.removeItem('certis_token'); window.location.reload(); },
  },
};

