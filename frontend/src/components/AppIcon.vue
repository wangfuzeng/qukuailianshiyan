<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: 'info' },
  size: { type: [Number, String], default: 20 },
})

const paths = {
  blocks: ['M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z', 'M4 12l8 4.5 8-4.5M4 16.5l8 4.5 8-4.5'],
  node: ['M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8'],
  cube: ['m12 2.8 8.2 4.6v9.2L12 21.2l-8.2-4.6V7.4L12 2.8Z', 'm3.8 7.4 8.2 4.6 8.2-4.6M12 12v9.2'],
  hash: ['M9.5 3 7.8 21M16.2 3l-1.7 18M4 8.5h16M3 15.5h16'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3.5 2'],
  refresh: ['M20 7v5h-5M4 17v-5h5', 'M6.1 8A7 7 0 0 1 18.8 6L20 12M4 12l1.2 6A7 7 0 0 0 17.9 16'],
  copy: ['M9 9h10v10H9z', 'M15 9V5H5v10h4'],
  check: ['m5 12 4.2 4.2L19 6.5'],
  close: ['m6 6 12 12M18 6 6 18'],
  search: ['M20 20l-4.2-4.2', 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z'],
  shield: ['M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z', 'm9 12 2 2 4-4'],
  activity: ['M3 12h4l2-5 3.5 10 2.5-5h6'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 11v5M12 8h.01'],
  database: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z', 'M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'],
  link: ['M10 13a5 5 0 0 0 7.1 0l1.9-1.9a5 5 0 0 0-7.1-7.1L10.5 5.4', 'M14 11a5 5 0 0 0-7.1 0L5 12.9a5 5 0 0 0 7.1 7.1l1.4-1.4'],
  pickaxe: ['M14.5 4.2c2.1.3 4.3 1.8 5.3 3.8-2-.5-4.2 0-5.8 1.3M6.4 20a2.3 2.3 0 0 1-3.2-3.2L14 6l3.9 3.9L6.4 20Z'],
  plus: ['M12 5v14M5 12h14'],
  command: ['M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z'],
  chevron: ['m9 6 6 6-6 6'],
  arrowLeft: ['M19 12H5m7 7-7-7 7-7'],
  trash: ['M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13'],
  checkCircle: ['M22 11.1V12a10 10 0 1 1-5.9-9.1', 'm9 11 3 3L22 4'],
  alert: ['M12 3 2.5 20h19L12 3Z', 'M12 9v5M12 17h.01'],
  zap: ['M13 2 3 14h8l-1 8 11-14h-8l0-6Z'],
}

const iconPaths = computed(() => paths[props.name] || paths.info)
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="path in iconPaths" :key="path" :d="path" />
  </svg>
</template>
