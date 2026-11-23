import { defineStore } from 'pinia';
import { fetchAdminMe, loginAdmin, logoutAdmin } from '../api/auth.js';

export const useAdminAuthStore = defineStore('admin-auth', {
  state: () => ({ user: null, initialized: false }),
  getters: {
    isLoggedIn: (state) => Boolean(state.user),
    isAdmin: (state) => state.user?.role === 'admin',
  },
  actions: {
    async login(payload) {
      const data = await loginAdmin(payload);
      this.user = data.admin;
      this.initialized = true;
      return data.admin;
    },
    async refreshMe() {
      try {
        const data = await fetchAdminMe();
        this.user = data.admin;
        return data.admin;
      } finally {
        this.initialized = true;
      }
    },
    async logout() {
      try { await logoutAdmin(); } catch { /* expired session */ }
      this.user = null;
      this.initialized = true;
    },
  },
});
