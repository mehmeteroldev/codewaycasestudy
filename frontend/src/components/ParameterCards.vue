<script setup>
import { fmtDate, renderValue } from '../utils/format';

defineProps({ items: { type: Array, required: true } });
const emit = defineEmits(['edit', 'delete']);
</script>

<template>
  <div class="cards">
    <div v-for="p in items" :key="p.id" class="card">
      <div class="line"><b>Parameter Key:</b> {{ p.key }}</div>
      <div class="line"><b>Value:</b> <span class="value">{{ renderValue(p.value) }}</span></div>
      <div class="line"><b>Description:</b> {{ p.description }}</div>
      <div class="line"><b>Create Date:</b> {{ fmtDate(p.createdAt) }}</div>
      <div v-if="Object.keys(p.countryOverrides || {}).length" class="line">
        <b>Countries:</b>
        <span v-for="c in Object.keys(p.countryOverrides)" :key="c" class="audience-badge">{{ c }}</span>
      </div>
      <div class="actions">
        <button class="btn btn-sm btn-primary" @click="emit('edit', p)">Edit</button>
        <button class="btn btn-sm btn-danger" @click="emit('delete', p)">Del</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cards { display: flex; flex-direction: column; gap: 12px; padding: 12px; }
.card {
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 16px 18px;
  background: var(--bg-row);
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.line { font-size: var(--fs-base); }
.line b { color: var(--text); margin-right: 2px; font-weight: 700; }
.value { word-break: break-all; }
.audience-badge {
  display: inline-block;
  font-size: var(--fs-2xs);
  background: var(--surface-success);
  color: var(--btn-success);
  padding: 1px 6px;
  margin-left: 4px;
  border-radius: 999px;
  font-weight: 600;
}
.actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  justify-content: center;
}
.actions .btn { min-width: 64px; padding: 7px 16px; font-size: var(--fs-md); }
</style>
