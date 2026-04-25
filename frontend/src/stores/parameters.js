import { defineStore } from 'pinia';
import { parametersApi } from '../services/api';

export const useParametersStore = defineStore('parameters', {
  state: () => ({
    items: [],
    loading: false,
    error: null,
  }),
  actions: {
    async fetch() {
      this.loading = true;
      this.error = null;
      try {
        this.items = await parametersApi.list();
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    async create(payload) {
      const created = await parametersApi.create(payload);
      this.items = [created, ...this.items];
      return created;
    },
    async update(id, payload) {
      try {
        const updated = await parametersApi.update(id, payload);
        this.items = this.items.map((p) => (p.id === id ? updated : p));
        return { ok: true, item: updated };
      } catch (e) {
        // Surface conflict details so the UI can show the latest server state.
        if (e.status === 409 && e.details?.current) {
          this.items = this.items.map((p) =>
            p.id === id ? e.details.current : p
          );
          return { ok: false, conflict: true, current: e.details.current, message: e.message };
        }
        throw e;
      }
    },
    async remove(id) {
      await parametersApi.remove(id);
      this.items = this.items.filter((p) => p.id !== id);
    },
  },
});
