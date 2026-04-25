<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
onMounted(() => auth.bootstrap());
</script>

<template>
  <div class="top-bar" />
  <router-view v-if="auth.ready" />
  <div v-else class="boot-splash">Loading…</div>
</template>

<style scoped>
.top-bar {
  height: 2px;
  background: var(--brand-bar);
}
.boot-splash {
  display: grid;
  place-items: center;
  min-height: 100vh;
  color: var(--text-muted);
  font-size: var(--fs-base);
}
</style>
