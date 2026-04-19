/**
 * API Client - FastAPI Backend
 * FastAPI backend for data/auth
 * Note: AI functions (invokeLLM) moved to @/lib/groqClient
 */

const API_BASE = '/api';

// Re-export AI functions from groqClient for backward compatibility
export { invokeLLM } from '@/lib/groqClient';

// Auth API
export const authApi = {
  me: async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('certis_token');
    const res = await fetch('/auth/me', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  }
};

// Incidents API
export const incidentsApi = {
  list: async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('certis_token');
    const res = await fetch(`${API_BASE}/incidents`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Failed to fetch incidents');
    return res.json();
  },
  get: async (id) => {
    const token = localStorage.getItem('token') || localStorage.getItem('certis_token');
    const res = await fetch(`${API_BASE}/incidents/${id}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Failed to fetch incident');
    return res.json();
  },
  update: async (id, data) => {
    const token = localStorage.getItem('token') || localStorage.getItem('certis_token');
    const res = await fetch(`${API_BASE}/incidents/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update incident');
    return res.json();
  }
};

// Officers API
export const officersApi = {
  list: async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('certis_token');
    const res = await fetch(`${API_BASE}/officers`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Failed to fetch officers');
    return res.json();
  },
  update: async (id, data) => {
    const token = localStorage.getItem('token') || localStorage.getItem('certis_token');
    const res = await fetch(`${API_BASE}/officers/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update officer');
    return res.json();
  }
};

// Recommendations API
export const recommendationsApi = {
  list: async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('certis_token');
    const res = await fetch(`${API_BASE}/recommendations`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Failed to fetch recommendations');
    return res.json();
  },
  create: async (data) => {
    const token = localStorage.getItem('token') || localStorage.getItem('certis_token');
    const res = await fetch(`${API_BASE}/recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create recommendation');
    return res.json();
  },
  update: async (id, data) => {
    const token = localStorage.getItem('token') || localStorage.getItem('certis_token');
    const res = await fetch(`${API_BASE}/recommendations/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update recommendation');
    return res.json();
  }
};