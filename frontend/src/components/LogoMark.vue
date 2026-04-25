<script setup>
defineProps({ size: { type: Number, default: 48 } });
</script>

<template>
  <img
    src="/logo.png"
    alt="Codeway"
    :style="{ height: size + 'px', width: 'auto' }"
    class="logo-mark"
  />
</template>

<style scoped>
.logo-mark { display: block; }
</style>
