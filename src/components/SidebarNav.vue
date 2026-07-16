<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="brand-mark">✦</span>
      <div>
        <strong>Starloom</strong>
        <span>GitHub Stars 管理工作台</span>
      </div>
    </div>

    <nav class="sidebar__nav" aria-label="仓库视图">
      <p class="sidebar__label">仓库</p>
      <button
        v-for="item in systemViews"
        :key="item.id"
        class="nav-item"
        :class="{ 'nav-item--active': activeView === item.id }"
        type="button"
        @click="emit('select-view', item.id)"
      >
        <span><span class="nav-item__icon">{{ item.icon }}</span>{{ item.label }}</span>
        <small>{{ item.count }}</small>
      </button>

      <div class="sidebar__heading">
        <p class="sidebar__label">LISTS</p>
        <button class="icon-button" title="新建分组" type="button" @click="emit('create-group')">
          ＋
        </button>
      </div>
      <div
        v-for="group in groups"
        :key="group.id"
        class="group-nav-row"
      >
        <button
          class="nav-item"
          :class="{ 'nav-item--active': activeView === group.id }"
          type="button"
          @click="emit('select-view', group.id)"
        >
          <span>
            <i class="group-dot" :style="{ backgroundColor: group.color }" />
            <span class="group-name">{{ group.name }}</span>
            <i
              v-if="group.githubId"
              class="group-origin"
              :title="group.isPrivate ? 'GitHub Private List' : 'GitHub Public List'"
            >{{ group.isPrivate ? '◆' : '◇' }}</i>
            <i v-else class="group-origin" title="尚未发布到 GitHub">LOCAL</i>
          </span>
          <small>{{ groupCounts[group.id] ?? 0 }}</small>
        </button>
        <div class="group-nav-row__actions">
          <button
            class="icon-button"
            type="button"
            :title="`编辑 ${group.name}`"
            @click="emit('edit-group', group.id)"
          >✎</button>
          <button
            class="icon-button"
            type="button"
            :title="`删除 ${group.name}`"
            @click="emit('delete-group', group.id)"
          >×</button>
        </div>
      </div>
    </nav>

    <div v-if="profile" class="profile-card">
      <img :alt="profile.login" :src="profile.avatarUrl" />
      <div>
        <strong>{{ profile.login }}</strong>
        <span>{{ lastSyncLabel }}</span>
      </div>
      <button class="icon-button" title="断开连接" type="button" @click="emit('disconnect')">↗</button>
    </div>

    <button
      type="button"
      class="sidebar__resize-handle"
      title="拖动调整侧栏宽度，双击恢复默认宽度"
      aria-label="调整侧栏宽度"
      @keydown="handleResizeKeydown"
      @dblclick="emit('resize', DEFAULT_WIDTH)"
      @pointerdown="startResize"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'

import type { GitHubProfile, RepositoryView, StarGroup } from '../types'

const props = defineProps<{
  width: number
  groups: StarGroup[]
  groupCounts: Record<string, number>
  activeView: RepositoryView
  totalCount: number
  inboxCount: number
  archivedCount: number
  staleCount: number
  profile?: GitHubProfile
  lastSyncAt: string
}>()

const emit = defineEmits<{
  'select-view': [view: RepositoryView]
  'create-group': []
  'edit-group': [groupId: string]
  'delete-group': [groupId: string]
  resize: [width: number]
  disconnect: []
}>()

const DEFAULT_WIDTH = 440
const RESIZE_STEP = 16
let handlePointerMove: ((event: PointerEvent) => void) | undefined
let handlePointerUp: (() => void) | undefined
let previousCursor = ''
let previousUserSelect = ''

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

  handlePointerMove = moveEvent => {
    emit('resize', startWidth + moveEvent.clientX - startX)
  }
  handlePointerUp = stopResize
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('blur', handlePointerUp, { once: true })
  window.addEventListener('pointerup', handlePointerUp, { once: true })
  window.addEventListener('pointercancel', handlePointerUp, { once: true })
}

const handleResizeKeydown = (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return
  event.preventDefault()

  if (event.key === 'Home') {
    emit('resize', DEFAULT_WIDTH)
    return
  }
  emit('resize', props.width + (event.key === 'ArrowLeft' ? -RESIZE_STEP : RESIZE_STEP))
}

onBeforeUnmount(stopResize)

const systemViews = computed(() => [
  { id: 'all', label: '全部收藏', icon: '✦', count: props.totalCount },
  { id: 'inbox', label: '待整理', icon: '⌁', count: props.inboxCount },
  { id: 'archived', label: '已归档', icon: '□', count: props.archivedCount },
  { id: 'stale', label: '长期未更新', icon: '◷', count: props.staleCount }
])

const lastSyncLabel = computed(() => {
  if (!props.lastSyncAt) return '尚未同步'
  return `同步于 ${new Date(props.lastSyncAt).toLocaleString('zh-CN')}`
})
</script>
