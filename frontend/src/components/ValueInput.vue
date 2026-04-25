<script setup>
import { computed, ref, watch } from 'vue';

// Accepts any JSON-serializable value. Displays a single-line input for primitives
// and switches to a multi-line JSON editor when the user toggles JSON mode, OR
// automatically when the current value is an object/array.
const props = defineProps({
  modelValue: { default: '' },
  placeholder: { type: String, default: 'Value' },
});
const emit = defineEmits(['update:modelValue', 'valid-change']);

const isStructured = (v) => typeof v === 'object' && v !== null;

const jsonMode = ref(isStructured(props.modelValue));
const text = ref(serialize(props.modelValue, jsonMode.value));
const parseError = ref('');

function serialize(val, asJson) {
  if (val === undefined || val === null) return '';
  if (asJson) return JSON.stringify(val, null, 2);
  return typeof val === 'string' ? val : JSON.stringify(val);
}

// When parent changes the value from outside, re-sync the input.
watch(
  () => props.modelValue,
  (v) => {
    const mode = jsonMode.value || isStructured(v);
    jsonMode.value = mode;
    text.value = serialize(v, mode);
    parseError.value = '';
  }
);

const onInput = (e) => {
  text.value = e.target.value;
  if (jsonMode.value) {
    try {
      const parsed = text.value.trim() === '' ? '' : JSON.parse(text.value);
      parseError.value = '';
      emit('valid-change', true);
      emit('update:modelValue', parsed);
    } catch (err) {
      parseError.value = 'Invalid JSON';
      emit('valid-change', false);
    }
  } else {
    parseError.value = '';
    emit('valid-change', true);
    emit('update:modelValue', text.value);
  }
};

const toggleMode = () => {
  // Try to promote the current string to JSON when switching ON; keep as string if it doesn't parse.
  if (!jsonMode.value) {
    try {
      const parsed = JSON.parse(text.value);
      jsonMode.value = true;
      text.value = JSON.stringify(parsed, null, 2);
      emit('update:modelValue', parsed);
    } catch {
      jsonMode.value = true;
    }
  } else {
    jsonMode.value = false;
    // Going back to string mode: if current is an object, stringify it compactly
    try {
      const parsed = JSON.parse(text.value);
      text.value = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      emit('update:modelValue', text.value);
    } catch {
      emit('update:modelValue', text.value);
    }
  }
  parseError.value = '';
};

const label = computed(() => (jsonMode.value ? 'JSON' : 'Text'));
</script>

<template>
  <div class="value-input">
    <div class="mode-row">
      <button type="button" class="btn btn-sm btn-ghost mode-btn" @click="toggleMode">
        <span class="badge">{{ label }}</span>
        <span class="switch-hint">switch</span>
      </button>
      <span v-if="parseError" class="error-text">{{ parseError }}</span>
    </div>
    <input
      v-if="!jsonMode"
      class="single"
      :value="text"
      :placeholder="placeholder"
      @input="onInput"
    />
    <textarea
      v-else
      class="multi"
      rows="6"
      :value="text"
      :placeholder="placeholder"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.value-input { display: flex; flex-direction: column; gap: 6px; }
.mode-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mode-btn { padding: 2px 6px; gap: 6px; }
.switch-hint { color: var(--text-muted); font-size: var(--fs-xs); }
.multi { font-family: var(--font-mono); font-size: var(--fs-md); resize: vertical; }
</style>
