<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="brand-mark">✦</span>
      <div>
        <strong>Starloom</strong>
        <span>Native Lists, organized</span>
      </div>
    </div>

    <nav class="sidebar__nav" aria-label="仓库视图">
      <p class="sidebar__label">LIBRARY</p>
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
        <p class="sidebar__label">GROUPS</p>
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
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { GitHubProfile, RepositoryView, StarGroup } from '../types'

const props = defineProps<{
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
  disconnect: []
}>()

const systemViews = computed(() => [
  { id: 'all', label: 'All stars', icon: '✦', count: props.totalCount },
  { id: 'inbox', label: 'Inbox', icon: '⌁', count: props.inboxCount },
  { id: 'archived', label: 'Archived', icon: '□', count: props.archivedCount },
  { id: 'stale', label: 'Stale', icon: '◷', count: props.staleCount }
])

const lastSyncLabel = computed(() => {
  if (!props.lastSyncAt) return '尚未同步'
  return `同步于 ${new Date(props.lastSyncAt).toLocaleString('zh-CN')}`
})
</script>
