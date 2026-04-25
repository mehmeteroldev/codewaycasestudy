import axios from 'axios';
import { firebaseAuth } from './firebase';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';

const client = axios.create({ baseURL });

// Attach a fresh Firebase ID token to every request.
client.interceptors.request.use(async (config) => {
  const user = firebaseAuth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize errors so UI code can read `err.message` and `err.status`.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err?.response?.data;
    const message = data?.error?.message || err.message || 'Request failed';
    const enriched = new Error(message);
    enriched.status = err?.response?.status;
    enriched.details = data?.error?.details;
    return Promise.reject(enriched);
  }
);

export const parametersApi = {
  list: () => client.get('/api/panel/parameters').then((r) => r.data.items),
  create: (payload) => client.post('/api/panel/parameters', payload).then((r) => r.data),
  update: (id, payload) => client.put(`/api/panel/parameters/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/api/panel/parameters/${id}`),
  suggestCountries: (payload) =>
    client
      .post('/api/panel/parameters/suggest-countries', payload)
      .then((r) => r.data), // { lenses, reasoning, suggestions }
};

export default client;
