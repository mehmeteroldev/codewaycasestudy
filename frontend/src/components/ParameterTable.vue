<script setup>
import { computed } from 'vue';
import { fmtDate, renderValue } from '../utils/format';

const props = defineProps({
  items: { type: Array, required: true },
});
const emit = defineEmits(['edit', 'delete']);

const sorted = computed(() =>
  [...props.items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
);
</script>

<template>
  <div class="table-wrap">
    <div class="thead">
      <div class="th col-key">Parameter Key</div>
      <div class="th col-value">Value</div>
      <div class="th col-desc">Description</div>
      <div class="th col-date">Create Date ↓</div>
      <div class="th col-actions" />
    </div>

    <div v-for="p in sorted" :key="p.id" class="row">
      <div class="cell col-key">
        {{ p.key }}
        <span v-if="Object.keys(p.countryOverrides || {}).length" class="audience-badge">
          +{{ Object.keys(p.countryOverrides).length }} country
        </span>
      </div>
      <div class="cell col-value">
        <span class="value-ellipsis">{{ renderValue(p.value) }}</span>
      </div>
      <div class="cell col-desc">{{ p.description }}</div>
      <div class="cell col-date">{{ fmtDate(p.createdAt) }}</div>
      <div class="cell col-actions">
        <button class="btn btn-sm btn-primary" @click="emit('edit', p)">Edit</button>
        <button class="btn btn-sm btn-danger" @click="emit('delete', p)">Delete</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-wrap {
  width: 100%;
  font-size: var(--fs-base);
}
.thead, .row {
  display: grid;
  grid-template-columns: 1fr 1fr 2.5fr 1fr 0.3fr auto;
  gap: 16px;
  padding: 12px 30px;
  align-items: center;
}
.thead {
  color: var(--text-accent);
  font-size: var(--fs-2xl);
}
.th, .cell { text-align: left; min-width: 0; }
.th.col-actions, .cell.col-actions { text-align: right; }
.row:hover { background: var(--surface-accent-subtle); }
.cell { min-width: 0; }
.col-key { display: flex; align-items: center; gap: 8px; }
.col-value .value-ellipsis,
.col-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.col-date { white-space: nowrap; }
.col-actions { display: flex; gap: 6px; justify-content: flex-end; }
.audience-badge {
  font-size: var(--fs-2xs);
  background: var(--surface-success);
  color: var(--btn-success);
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 600;
}
</style>
