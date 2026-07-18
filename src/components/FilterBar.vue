<template>
  <div class="mb-[18px] grid grid-cols-1 gap-3 lg:grid-cols-[minmax(300px,1fr)_190px_190px]">
    <ElInput
      clearable
      size="large"
      placeholder="搜索仓库、简介、Topic 或标签…"
      :model-value="search"
      @update:model-value="emit('update:search', $event)"
    >
      <template #prefix>
        <ElIcon>
          <Search />
        </ElIcon>
      </template>
      <template #suffix><span class="text-xs text-slate-400 dark:text-slate-500">⌘ K</span></template>
    </ElInput>
    <ElSelect
      size="large"
      aria-label="编程语言"
      placeholder="全部语言"
      :model-value="language"
      @update:model-value="emit('update:language', $event)"
    >
      <ElOption label="全部语言" value="" />
      <ElOption v-for="item in languages" :key="item" :label="item" :value="item" />
    </ElSelect>
    <ElSelect
      size="large"
      aria-label="排序方式"
      :model-value="sort"
      @update:model-value="emit('update:sort', $event)"
    >
      <ElOption v-if="module === 'starred'" label="最近收藏" value="starred-desc" />
      <ElOption label="最近更新" value="updated-desc" />
      <ElOption label="Stars 最多" value="stars-desc" />
      <ElOption label="名称 A–Z" value="name-asc" />
    </ElSelect>
  </div>
</template>

<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'

import type { RepositoryModule } from '../types'

defineProps<{
  module: RepositoryModule
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
