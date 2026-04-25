<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useParametersStore } from '../stores/parameters';
import AppHeader from '../components/AppHeader.vue';
import ParameterTable from '../components/ParameterTable.vue';
import ParameterCards from '../components/ParameterCards.vue';
import EditParameterModal from '../components/EditParameterModal.vue';

const store = useParametersStore();

// Create row (always-visible "new parameter" row at bottom of table)
const draft = ref({ key: '', value: '', description: '' });
const creating = ref(false);
const createError = ref('');

// Edit modal
const editModalRef = ref(null);
const editing = ref(null); // the parameter currently being edited

// Media query driven responsive switch (CSS handles visual, JS handles rendering cost)
const mql = window.matchMedia('(max-width: 720px)');
const isNarrow = ref(mql.matches);
const onMqlChange = (e) => (isNarrow.value = e.matches);
mql.addEventListener('change', onMqlChange);
onBeforeUnmount(() => mql.removeEventListener('change', onMqlChange));

onMounted(() => store.fetch());

const items = computed(() => store.items);

const onCreate = async () => {
  createError.value = '';
  if (!draft.value.key.trim()) {
    createError.value = 'Parameter key is required.';
    return;
  }
  creating.value = true;
  try {
    await store.create({
      key: draft.value.key.trim(),
      value: draft.value.value,
      description: draft.value.description,
    });
    draft.value = { key: '', value: '', description: '' };
  } catch (e) {
    createError.value = e.message || 'Failed to create parameter.';
  } finally {
    creating.value = false;
  }
};

const onEdit = (p) => (editing.value = p);
const onCloseEdit = () => (editing.value = null);

const onSaveEdit = async (payload) => {
  const result = await store.update(editing.value.id, payload);
  if (result?.ok) {
    editing.value = null;
  } else if (result?.conflict) {
    // Surface the conflict in the modal; the store already swapped our local copy
    // for the latest server state, so re-opening shows the latest values.
    editModalRef.value?.setError(
      result.message + ' Your view has been refreshed with the latest values — please review and retry.'
    );
    // Re-bind modal to the refreshed parameter so the user sees the new version
    editing.value = store.items.find((p) => p.id === editing.value.id) || null;
  }
};

const onDelete = async (p) => {
  const msg = `Delete parameter "${p.key}"? This cannot be undone.`;
  if (!window.confirm(msg)) return;
  await store.remove(p.id);
};
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="main">
      <div v-if="store.loading && items.length === 0" class="muted padded">Loading…</div>
      <div v-else-if="store.error" class="error-text padded">{{ store.error }}</div>

      <!-- Desktop: table; Mobile: cards -->
      <template v-if="!isNarrow">
        <ParameterTable :items="items" @edit="onEdit" @delete="onDelete" />
        <div class="new-row">
          <input v-model="draft.key" placeholder="New Parameter" class="col-key-in" />
          <input v-model="draft.value" placeholder="Value" class="col-val-in" />
          <input v-model="draft.description" placeholder="New Description" class="col-desc-in" />
          <div class="spacer" />
          <button class="btn btn-sm btn-success add-btn" :disabled="creating" @click="onCreate">
            {{ creating ? '…' : 'ADD' }}
          </button>
        </div>
        <div v-if="createError" class="error-text padded">{{ createError }}</div>
      </template>

      <template v-else>
        <ParameterCards :items="items" @edit="onEdit" @delete="onDelete" />
        <div class="mobile-new">
          <h3>Add parameter</h3>
          <input v-model="draft.key" placeholder="Parameter key" />
          <input v-model="draft.value" placeholder="Value" />
          <input v-model="draft.description" placeholder="Description" />
          <button class="btn btn-success" :disabled="creating" @click="onCreate">
            {{ creating ? 'Adding…' : 'Add' }}
          </button>
          <div v-if="createError" class="error-text">{{ createError }}</div>
        </div>
      </template>
    </main>

    <EditParameterModal
      ref="editModalRef"
      :open="!!editing"
      :parameter="editing"
      @close="onCloseEdit"
      @save="onSaveEdit"
    />
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; background: var(--bg); }
.main { flex: 1; padding: 20px 12px; }
.padded { padding: 20px 16px; }

.new-row {
  display: grid;
  grid-template-columns: 1fr 1fr 3.5fr 0fr 0.3fr auto;
  gap: 16px;
  padding: 12px 30px;
  align-items: center;
}

.col-key-in, .col-val-in, .col-desc-in { width: 100%; }
.add-btn {
  justify-self: end;
  width: 65px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.mobile-new {
  margin: 12px;
  padding: 14px 16px;
  background: var(--bg-row);
  border: 2px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mobile-new h3 { margin: 0 0 4px; font-size: var(--fs-base); color: var(--text-accent); }

@media (max-width: 720px) {
  .main { padding: 0; }
}
</style>
