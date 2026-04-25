<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LogoMark from '../components/LogoMark.vue';

const router = useRouter();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const submitting = ref(false);
const error = ref('');

const onSubmit = async () => {
  error.value = '';
  submitting.value = true;
  try {
    await auth.signIn(email.value.trim(), password.value);
    router.replace({ name: 'home' });
  } catch (e) {
    error.value = mapAuthError(e);
  } finally {
    submitting.value = false;
  }
};

// Firebase Auth codes → user-facing messages
const mapAuthError = (e) => {
  const code = e?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Incorrect email or password.';
  }
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again later.';
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  return e?.message || 'Sign-in failed.';
};
</script>

<template>
  <div class="signin-page">
    <div class="content">
      <LogoMark :size="350" />
      <h1 class="title">Please sign in</h1>
      <form class="form" @submit.prevent="onSubmit">
        <input
          v-model="email"
          type="email"
          placeholder="E-mail address"
          required
          autocomplete="email"
          class="input input-accent"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          required
          autocomplete="current-password"
          class="input"
        />
        <button type="submit" class="btn btn-primary btn-signin" :disabled="submitting">
          {{ submitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <p v-if="error" class="error-text">{{ error }}</p>
      <p class="footer">Codeway © {{ new Date().getFullYear() }}</p>
    </div>
  </div>
</template>

<style scoped>
.signin-page {
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50px;
}
.title {
  font-size: var(--fs-3xl);
  font-weight: 500;
  color: var(--title-dim);
  margin: 0 0 20px;
}
.form {
  width: 100%;
  max-width: 280px;
  display: flex;
  flex-direction: column;
}
.input { width: 100%; }
.input-accent { border-color: var(--border-focus); }
.btn-signin { margin-top: 6px; padding: 10px; font-size: var(--fs-base); }
.error-text { margin-top: 12px; }
.footer {
  margin-top: 20px;
  color: var(--text-muted);
  font-size: var(--fs-sm);
}
</style>
