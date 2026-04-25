<script setup>
import { computed, ref } from 'vue';
import ValueInput from './ValueInput.vue';
import { parametersApi } from '../services/api';
import { isCountryCode, normalizeCountryCode } from '../utils/validators';

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  paramKey: { type: String, default: '' },
  paramDescription: { type: String, default: '' },
  defaultValue: { default: '' },
});
const emit = defineEmits(['update:modelValue']);

const newCode = ref('');
const suggesting = ref(false);
const suggestions = ref([]);
const suggestReasoning = ref('');
const suggestLenses = ref([]);
const suggestError = ref('');

const entries = computed(() =>
  Object.entries(props.modelValue).sort(([a], [b]) => a.localeCompare(b))
);

const emitUpdate = (next) => emit('update:modelValue', next);

const addCountry = () => {
  const code = normalizeCountryCode(newCode.value);
  if (!isCountryCode(code)) {
    suggestError.value = 'Country code must be 2 uppercase letters (ISO 3166-1 alpha-2).';
    return;
  }
  if (code in props.modelValue) {
    suggestError.value = `"${code}" is already in the list.`;
    return;
  }
  suggestError.value = '';
  emitUpdate({ ...props.modelValue, [code]: props.defaultValue });
  newCode.value = '';
};

const removeCountry = (code) => {
  const next = { ...props.modelValue };
  delete next[code];
  emitUpdate(next);
};

const setValue = (code, value) => {
  emitUpdate({ ...props.modelValue, [code]: value });
};

const fetchSuggestions = async () => {
  suggestError.value = '';

  // If user typed a code in the add-row input, target that single country.
  // Otherwise fall back to multi-country suggestions.
  let targetCountry = null;
  const typed = normalizeCountryCode(newCode.value);
  if (typed) {
    if (!isCountryCode(typed)) {
      suggestError.value = 'Country code must be 2 uppercase letters (ISO 3166-1 alpha-2).';
      return;
    }
    if (typed in props.modelValue) {
      suggestError.value = `"${typed}" is already in the list.`;
      return;
    }
    targetCountry = typed;
  }

  suggesting.value = true;
  try {
    const result = await parametersApi.suggestCountries({
      key: props.paramKey,
      description: props.paramDescription,
      defaultValue: props.defaultValue,
      ...(targetCountry ? { country: targetCountry } : {}),
    });
    suggestions.value = result.suggestions || [];
    suggestReasoning.value = result.reasoning || '';
    suggestLenses.value = result.lenses || [];
  } catch (e) {
    suggestError.value = e.message || 'Could not fetch suggestions.';
    suggestions.value = [];
    suggestReasoning.value = '';
    suggestLenses.value = [];
  } finally {
    suggesting.value = false;
  }
};

const applySuggestion = (s) => {
  emitUpdate({ ...props.modelValue, [s.country]: s.value });
  suggestions.value = suggestions.value.filter((x) => x.country !== s.country);
};

const dismissSuggestion = (code) => {
  suggestions.value = suggestions.value.filter((x) => x.country !== code);
};
</script>

<template>
  <div class="country-overrides">
    <div class="section-header">
      <h3>Country audiences</h3>
      <button
        type="button"
        class="btn btn-sm btn-primary"
        :disabled="suggesting || !paramKey"
        @click="fetchSuggestions"
      >
        {{ suggesting ? 'Generating…' : 'Suggest with AI' }}
      </button>
    </div>
    <p class="help">
      Override the default value for specific countries.
      Clients sending <code>?country=XX</code> will receive the override; others get the default.
    </p>

    <!-- AI suggestions panel -->
    <div v-if="suggestions.length || suggestError || suggestReasoning" class="suggestions">
      <div v-if="suggestError" class="error-text">{{ suggestError }}</div>

      <!-- Reasoning banner: the AI's analysis (lenses + one-sentence rationale) -->
      <div v-if="suggestReasoning" class="reasoning-banner">
        <div v-if="suggestLenses.length" class="lenses">
          <span v-for="lens in suggestLenses" :key="lens" class="lens-chip">{{ lens }}</span>
        </div>
        <div class="reasoning-text">{{ suggestReasoning }}</div>
        <div v-if="!suggestions.length" class="empty-hint">
          No overrides proposed — this parameter does not appear to need localization.
        </div>
      </div>

      <div
        v-for="s in suggestions"
        :key="s.country"
        class="suggestion"
      >
        <div class="suggestion-head">
          <span class="badge">{{ s.country }}</span>
          <span class="rationale">{{ s.rationale }}</span>
        </div>
        <div class="suggestion-body">
          <code class="proposed">{{ typeof s.value === 'string' ? s.value : JSON.stringify(s.value) }}</code>
          <div class="suggestion-actions">
            <button type="button" class="btn btn-sm btn-success" @click="applySuggestion(s)">Apply</button>
            <button type="button" class="btn btn-sm btn-danger" @click="dismissSuggestion(s.country)">Dismiss</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Existing overrides -->
    <div v-if="entries.length === 0" class="empty muted">No country overrides yet.</div>
    <div v-for="[code, val] in entries" :key="code" class="override">
      <div class="override-head">
        <span class="badge">{{ code }}</span>
        <button type="button" class="btn btn-sm btn-ghost" @click="removeCountry(code)">Remove</button>
      </div>
      <ValueInput :model-value="val" @update:model-value="(v) => setValue(code, v)" />
    </div>

    <!-- Add new -->
    <div class="add-row">
      <input
        v-model="newCode"
        maxlength="2"
        placeholder="e.g. TR"
        class="code-input"
        @keydown.enter.prevent="addCountry"
      />
      <button type="button" class="btn btn-sm btn-primary" @click="addCountry">Add country</button>
    </div>
  </div>
</template>

<style scoped>
.country-overrides { display: flex; flex-direction: column; gap: 12px; }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.section-header h3 { margin: 0; font-size: var(--fs-base); color: var(--text); }
.help { margin: 0; color: var(--text-muted); font-size: var(--fs-sm); }
.help code { background: var(--bg-input); padding: 1px 5px; border-radius: 3px; }
.empty { padding: 8px 0; font-size: var(--fs-md); }
.override {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-row);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.override-head { display: flex; align-items: center; justify-content: space-between; }
.add-row { display: flex; align-items: center; gap: 8px; }
.suggestion-actions { display: flex; align-items: center; gap: 6px; }
.code-input { width: 80px; text-transform: uppercase; }
.suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--surface-success-subtle);
  border: 1px dashed var(--border-success);
  border-radius: var(--radius);
}
.suggestion { display: flex; flex-direction: column; gap: 6px; padding-top: 10px; }
.suggestion + .suggestion { border-top: 1px solid var(--border-success); }
.suggestion-head { display: flex; align-items: center; gap: 8px; }
.rationale { color: var(--text-muted); font-size: var(--fs-sm); }
.suggestion-body { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.proposed {
  background: var(--bg-input);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: var(--fs-sm);
  word-break: break-all;
  flex: 1;
  min-width: 0;
}
.reasoning-banner {
  padding: 10px 12px;
  background: var(--surface-info);
  border: 1px solid var(--border-info);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lenses { display: flex; flex-wrap: wrap; gap: 4px; }
.lens-chip {
  font-size: var(--fs-2xs);
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface-info-strong);
  color: var(--text-info);
  text-transform: lowercase;
  letter-spacing: 0.3px;
}
.reasoning-text { font-size: var(--fs-sm); color: var(--text); line-height: 1.45; }
.empty-hint { font-size: var(--fs-xs); color: var(--text-muted); font-style: italic; }
</style>
