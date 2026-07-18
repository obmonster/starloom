<template>
  <div class="sidebar">
    <div class="sidebar__nav" aria-label="仓库视图">
      <div class="sidebar__label">{{ module === 'owned' ? '仓库范围' : '智能视图' }}</div>
      <ElButton
        v-for="item in systemViews"
        text
        class="nav-item !ml-0"
        :key="item.id"
        :class="{ 'nav-item--active': activeView === item.id }"
        @click="emit('select-view', item.id)"
      >
        <span class="nav-item__content">
          <ElIcon class="nav-item__icon">
            <component :is="item.icon" />
          </ElIcon>
          {{ item.label }}
        </span>
        <span class="text-xs">{{ item.count }}</span>
      </ElButton>

      <template v-if="module === 'starred'">
        <div class="sidebar__heading">
          <div class="sidebar__label">LISTS</div>
          <ElButton
            text
            circle
            class="icon-button"
            title="新建 List"
            :icon="Plus"
            @click="emit('create-group')"
          />
        </div>
        <div v-for="group in groups" :key="group.id" class="group-nav-row">
          <ElButton
            text
            class="nav-item !ml-0"
            :class="{ 'nav-item--active': activeView === group.id }"
            @click="emit('select-view', group.id)"
          >
            <span class="nav-item__content">
              <span class="group-dot inline-block" :style="{ backgroundColor: group.color }" />
              <span class="group-name">{{ group.name }}</span>
              <ElIcon
                v-if="group.githubId"
                class="group-origin"
                :title="group.isPrivate ? 'GitHub Private List' : 'GitHub Public List'"
              >
                <component :is="group.isPrivate ? Lock : Unlock" />
              </ElIcon>
              <span v-else class="group-origin" title="尚未发布到 GitHub">LOCAL</span>
            </span>
            <span class="text-xs">{{ groupCounts[group.id] ?? 0 }}</span>
          </ElButton>
          <div class="group-nav-row__actions">
            <ElButton
              text
              circle
              class="icon-button !ml-0"
              :icon="EditPen"
              :title="`编辑 ${group.name}`"
              @click="emit('edit-group', group.id)"
            />
            <ElButton
              text
              circle
              class="icon-button !ml-0"
              :icon="Delete"
              :title="`删除 ${group.name}`"
              @click="emit('delete-group', group.id)"
            />
          </div>
        </div>
      </template>
    </div>

    <div class="sidebar-status">
      <span class="sidebar-status__dot" />
      <span>{{ lastSyncLabel }}</span>
    </div>

    <ElButton
      text
      class="sidebar__resize-handle"
      title="拖动调整侧栏宽度，双击恢复默认宽度"
      aria-label="调整侧栏宽度"
      @keydown="handleResizeKeydown"
      @dblclick="emit('resize', DEFAULT_WIDTH)"
      @pointerdown="startResize"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import {
  Box,
  Collection,
  Connection,
  Delete,
  EditPen,
  ForkSpoon,
  Lock,
  OfficeBuilding,
  Plus,
  StarFilled,
  TakeawayBox,
  Timer,
  Unlock,
  User
} from '@element-plus/icons-vue'

import type { Component } from 'vue'
import type { StarGroup, RepositoryView, RepositoryModule } from '../types'

const props = defineProps<{
  width: number
  module: RepositoryModule
  groups: StarGroup[]
  groupCounts: Record<string, number>
  activeView: RepositoryView
  managedCount: number
  ownedCount: number
  organizationCount: number
  collaboratedCount: number
  publicCount: number
  nonPublicCount: number
  forkCount: number
  ownedArchivedCount: number
  starCount: number
  inboxCount: number
  archivedCount: number
  staleCount: number
  lastSyncAt: string
}>()

const emit = defineEmits<{
  'select-view': [view: RepositoryView]
  'create-group': []
  'edit-group': [groupId: string]
  'delete-group': [groupId: string]
  resize: [width: number]
}>()

const DEFAULT_WIDTH = 280
const RESIZE_STEP = 16
let handlePointerMove: ((event: PointerEvent) => void) | undefined
let handlePointerUp: (() => void) | undefined
let previousCursor = ''
let previousUserSelect = ''

const systemViews = computed(() => props.module === 'owned'
  ? [
      { id: 'managed', label: '全部仓库', icon: Collection, count: props.managedCount },
      { id: 'owned', label: '个人仓库', icon: User, count: props.ownedCount },
      { id: 'organization', label: '组织仓库', icon: OfficeBuilding, count: props.organizationCount },
      { id: 'collaborated', label: '协作仓库', icon: Connection, count: props.collaboratedCount },
      { id: 'public', label: 'Public', icon: Unlock, count: props.publicCount },
      { id: 'non-public', label: 'Private / Internal', icon: Lock, count: props.nonPublicCount },
      { id: 'forks', label: 'Fork', icon: ForkSpoon, count: props.forkCount },
      { id: 'owned-archived', label: 'Archived', icon: Box, count: props.ownedArchivedCount }
    ] as Array<{ id: RepositoryView; label: string; icon: Component; count: number }>
  : [
      { id: 'stars', label: '全部 Stars', icon: StarFilled, count: props.starCount },
      { id: 'inbox', label: '待整理', icon: TakeawayBox, count: props.inboxCount },
      { id: 'archived', label: '已归档', icon: Box, count: props.archivedCount },
      { id: 'stale', label: '长期未更新', icon: Timer, count: props.staleCount }
    ] as Array<{ id: RepositoryView; label: string; icon: Component; count: number }>
)

const lastSyncLabel = computed(() => {
  if (!props.lastSyncAt) return '尚未同步'
  return `同步于 ${new Date(props.lastSyncAt).toLocaleString('zh-CN')}`
})

const stopResize = () => {
  if (handlePointerMove) window.removeEventListener('pointermove', handlePointerMove)
  if (handlePointerUp) {
    window.removeEventListener('blur', handlePointerUp)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerUp)
  }
  handlePointerMove = undefined
  handlePointerUp = undefined
  document.body.style.cursor = previousCursor
  document.body.style.userSelect = previousUserSelect
}

const startResize = (event: PointerEvent) => {
  if (event.button !== 0) return
  event.preventDefault()
  stopResize()

  const startX = event.clientX
  const startWidth = props.width
  previousCursor = document.body.style.cursor
  previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  handlePointerMove = moveEvent => emit('resize', startWidth + moveEvent.clientX - startX)
  handlePointerUp = stopResize
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('blur', handlePointerUp, { once: true })
  window.addEventListener('pointerup', handlePointerUp, { once: true })
  window.addEventListener('pointercancel', handlePointerUp, { once: true })
}

const handleResizeKeydown = (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') return emit('resize', DEFAULT_WIDTH)
  emit('resize', props.width + (event.key === 'ArrowLeft' ? -RESIZE_STEP : RESIZE_STEP))
}

onBeforeUnmount(stopResize)
</script>
