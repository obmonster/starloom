<template>
  <div class="bulk-bar">
    <strong>{{ selectedCount }} selected</strong>
    <span class="bulk-bar__divider" />
    <select v-model="groupId" aria-label="目标分组">
      <option value="">Add to group…</option>
      <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
    </select>
    <button class="button button--compact" type="button" :disabled="!groupId" @click="assignGroup">
      应用
    </button>
    <input v-model="tags" class="bulk-bar__tags" placeholder="标签，逗号分隔" />
    <button class="button button--compact" type="button" :disabled="!tags.trim()" @click="addTags">
      添加标签
    </button>
    <button class="button button--compact" type="button" @click="emit('auto-classify')">
      ✦ 自动分类
    </button>
    <button class="button button--compact button--danger" type="button" @click="emit('unstar')">
      Unstar
    </button>
    <button class="bulk-bar__close" type="button" @click="emit('clear')">×</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { StarGroup } from '../types'

defineProps<{
  selectedCount: number
  groups: StarGroup[]
}>()

const emit = defineEmits<{
  'assign-group': [groupId: string]
  'add-tags': [tags: string[]]
  'auto-classify': []
  unstar: []
  clear: []
}>()

const groupId = ref('')
const tags = ref('')

const assignGroup = () => {
  if (!groupId.value) return
  emit('assign-group', groupId.value)
  groupId.value = ''
}

const addTags = () => {
  const values = tags.value.split(',').map(tag => tag.trim()).filter(Boolean)
  if (!values.length) return
  emit('add-tags', values)
  tags.value = ''
}
</script>
