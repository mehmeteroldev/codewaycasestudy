import { defineStore } from 'pinia';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { firebaseAuth } from '../services/firebase';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    ready: false, // flips to true after the initial auth-state check
  }),
  getters: {
    isAuthenticated: (s) => !!s.user,
  },
  actions: {
    bootstrap() {
      // Resolves once Firebase tells us whether there's a persisted session.
      if (this._bootstrapping) return this._bootstrapping;
      this._bootstrapping = new Promise((resolve) => {
        onAuthStateChanged(firebaseAuth, (fbUser) => {
          this.user = fbUser
            ? { uid: fbUser.uid, email: fbUser.email }
            : null;
          this.ready = true;
          resolve();
        });
      });
      return this._bootstrapping;
    },
    async signIn(email, password) {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    },
    async signOut() {
      await signOut(firebaseAuth);
    },
  },
});
