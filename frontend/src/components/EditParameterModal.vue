<script setup>
import { ref, watch, computed } from 'vue';
import ValueInput from './ValueInput.vue';
import CountryOverridesEditor from './CountryOverridesEditor.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  parameter: { type: Object, default: null }, // full param object
});
const emit = defineEmits(['close', 'save']);

// Local editable copy
const form = ref({ value: '', description: '', countryOverrides: {} });
const valueValid = ref(true);
const saving = ref(false);
const error = ref('');

watch(
  () => [props.open, props.parameter],
  () => {
    if (props.open && props.parameter) {
      form.value = {
        value: props.parameter.value ?? '',
        description: props.parameter.description || '',
        countryOverrides: { ...(props.parameter.countryOverrides || {}) },
      };
      error.value = '';
      valueValid.value = true;
    }
  },
  { immediate: true }
);

const canSave = computed(() => valueValid.value && !saving.value);

const onSave = async () => {
  if (!canSave.value) return;
  saving.value = true;
  error.value = '';
  try {
    emit('save', {
      value: form.value.value,
      description: form.value.description,
      countryOverrides: form.value.countryOverrides,
      expectedVersion: props.parameter.version,
    });
  } finally {
    saving.value = false;
  }
};

// Allow the parent to signal an error back (e.g. conflict) without closing
defineExpose({ setError: (msg) => (error.value = msg) });
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="muted small">Parameter</div>
          <h2 class="key">{{ parameter?.key }}</h2>
        </div>
        <button class="btn btn-ghost close" @click="emit('close')" aria-label="Close">×</button>
      </div>

      <div class="modal-body">
        <div class="field">
          <label class="label">Default value</label>
          <ValueInput
            v-model="form.value"
            @valid-change="(v) => (valueValid = v)"
          />
        </div>

        <div class="field">
          <label class="label">Description</label>
          <input v-model="form.description" placeholder="Short description" />
        </div>

        <div class="divider" />

        <CountryOverridesEditor
          v-model="form.countryOverrides"
          :param-key="parameter?.key"
          :param-description="form.description"
          :default-value="form.value"
        />
      </div>

      <div v-if="error" class="modal-error">{{ error }}</div>

      <div class="modal-foot">
        <button class="btn btn-ghost" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="!canSave" @click="onSave">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}
.modal {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 100%;
  max-width: 1000px;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow);
}
.modal-head {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.modal-head .small { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.4px; }
.key { margin: 4px 0 0; font-size: var(--fs-xl); font-weight: 600; color: var(--text-accent); }
.close { font-size: var(--fs-2xl); line-height: 1; padding: 0 8px; }
.modal-body {
  padding: 18px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field { display: flex; flex-direction: column; }
.divider { height: 1px; background: var(--border); margin: 6px 0; }
.modal-foot {
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.modal-error {
  padding: 10px 20px;
  background: var(--surface-danger);
  color: var(--btn-danger);
  font-size: var(--fs-md);
  border-top: 1px solid var(--border);
}
</style>
