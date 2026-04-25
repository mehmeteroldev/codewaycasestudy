import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/ParametersView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/signin',
    name: 'signin',
    component: () => import('../views/SignInView.vue'),
    meta: { guestOnly: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.bootstrap();
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'signin' };
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'home' };
  return true;
});

export default router;
