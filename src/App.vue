<template>
  <RouterView v-slot="{ Component }">
    <component v-model:dark-mode="darkMode" :is="Component" />
  </RouterView>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView } from 'vue-router'

const THEME_KEY = 'starloom.theme'
const savedTheme = localStorage.getItem(THEME_KEY)
const darkMode = ref(
  savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
)

watch(darkMode, enabled => {
  const theme = enabled ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', enabled)
  document.documentElement.style.colorScheme = theme
  localStorage.setItem(THEME_KEY, theme)
}, { immediate: true })
</script>
