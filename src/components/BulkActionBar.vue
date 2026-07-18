<template>
  <div class="bulk-bar">
    <span class="font-semibold">已选择 {{ selectedCount }} 个</span>
    <span class="bulk-bar__divider" />
    <ElSelect
      v-model="groupId"
      class="w-44"
      aria-label="目标分组"
      placeholder="加入 GitHub List…"
    >
      <ElOption v-for="group in groups" :key="group.id" :label="group.name" :value="group.id" />
    </ElSelect>
    <ElButton :icon="Check" :disabled="!groupId" @click="assignGroup">应用</ElButton>
    <ElInput v-model="tags" class="min-w-40 flex-1" placeholder="标签，逗号分隔" />
    <ElButton :icon="PriceTag" :disabled="!tags.trim()" @click="addTags">添加标签</ElButton>
    <ElButton :icon="MagicStick" @click="emit('auto-classify')">自动分类</ElButton>
    <ElButton
      type="danger"
      :icon="Star"
      :disabled="!starredCount"
      @click="emit('unstar')"
    >Unstar{{ starredCount ? ` (${starredCount})` : '' }}</ElButton>
    <ElButton
      text
      circle
      aria-label="清除选择"
      :icon="Close"
      @click="emit('clear')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Check, Close, MagicStick, PriceTag, Star } from '@element-plus/icons-vue'

import type { StarGroup } from '../types'

defineProps<{
  selectedCount: number
  starredCount: number
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
