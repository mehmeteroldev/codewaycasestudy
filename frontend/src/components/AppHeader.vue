<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LogoMark from './LogoMark.vue';

const auth = useAuthStore();
const router = useRouter();

const menuOpen = ref(false);
const menuRef = ref(null);

const toggle = () => (menuOpen.value = !menuOpen.value);

const onDocClick = (e) => {
  if (menuRef.value && !menuRef.value.contains(e.target)) menuOpen.value = false;
};

onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));

const onSignOut = async () => {
  await auth.signOut();
  router.replace({ name: 'signin' });
};
</script>

<template>
  <header class="header">
    <LogoMark :size="72" />
    <div class="spacer" />
    <div class="user-menu" ref="menuRef">
      <button class="avatar" @click.stop="toggle" aria-label="User menu">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6Z" />
        </svg>
        <span class="chev">▾</span>
      </button>
      <div v-if="menuOpen" class="menu">
        <div class="menu-email">{{ auth.user?.email }}</div>
        <button class="menu-item" @click="onSignOut">Sign out</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  padding: 14px 28px;
  background: var(--bg-elevated);
}
.spacer { flex: 1; }
.user-menu { position: relative; }
.avatar {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text);
  background: transparent;
  padding: 4px 6px;
  border-radius: var(--radius);
}
.avatar:hover { background: var(--surface-hover); }
.chev { font-size: var(--fs-sm); color: var(--text-muted); }
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 180px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  z-index: 10;
}
.menu-email {
  padding: 10px 12px;
  font-size: var(--fs-sm);
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  word-break: break-all;
}
.menu-item {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  background: transparent;
  color: var(--text);
  font-size: var(--fs-md);
}
.menu-item:hover { background: var(--surface-accent); }

@media (max-width: 640px) {
  .header { padding: 12px 16px; }
}
</style>
