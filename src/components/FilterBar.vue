<template>
  <section class="filter-bar">
    <div class="search-input">
      <span>⌕</span>
      <input
        :value="search"
        placeholder="搜索仓库、简介、Topic 或标签…"
        type="search"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
      />
      <kbd>⌘ K</kbd>
    </div>
    <select
      :value="language"
      aria-label="编程语言"
      @change="emit('update:language', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">全部语言</option>
      <option v-for="item in languages" :key="item" :value="item">{{ item }}</option>
    </select>
    <select
      :value="sort"
      aria-label="排序方式"
      @change="emit('update:sort', ($event.target as HTMLSelectElement).value)"
    >
      <option value="starred-desc">最近收藏</option>
      <option value="updated-desc">最近更新</option>
      <option value="stars-desc">Stars 最多</option>
      <option value="name-asc">名称 A–Z</option>
    </select>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  search: string
  language: string
  sort: string
  languages: string[]
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:language': [value: string]
  'update:sort': [value: string]
}>()
</script>
