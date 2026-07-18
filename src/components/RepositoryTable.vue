<template>
  <ElTable
    class="repository-table"
    :data="repositories"
    :class="`repository-table--${module}`"
    :row-key="repositoryRowKey"
  >
    <ElTableColumn
      v-if="module === 'starred'"
      align="center"
      width="52"
    >
      <template #header>
        <ElCheckbox
          :model-value="allSelected"
          :indeterminate="someSelected && !allSelected"
          @change="emit('toggle-all')"
        />
      </template>
      <template #default="{ row: repository }">
        <ElCheckbox
          :model-value="selectedIds.includes(repository.id)"
          @change="emit('toggle', repository.id)"
        />
      </template>
    </ElTableColumn>

    <ElTableColumn label="仓库" min-width="400">
      <template #default="{ row: repository }">
        <div class="repository-main">
          <div class="repository-main__title">
            <ElLink
              rel="noreferrer"
              target="_blank"
              underline="never"
              :href="repository.htmlUrl"
            >{{ repository.fullName }}</ElLink>
            <ElTag
              v-if="module === 'starred' && repository.ownership !== 'external'"
              type="success"
              effect="plain"
            >{{ ownershipLabel(repository.ownership) }}</ElTag>
            <ElTag
              v-if="module === 'starred' && repository.visibility !== 'public'"
              effect="plain"
            >{{ repository.visibility }}</ElTag>
            <ElTag v-if="module === 'owned' && repository.isStarred" effect="plain">Starred</ElTag>
            <ElTag v-if="repository.archived" type="warning" effect="plain">Archived</ElTag>
            <ElTag v-if="repository.fork" effect="plain">Fork</ElTag>
          </div>
          <div class="my-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {{ repository.description || '暂无仓库简介。' }}
          </div>
          <div v-if="repository.topics.length || repository.tags.length" class="tag-row">
            <ElTag
              v-for="topic in repository.topics.slice(0, 4)"
              effect="plain"
              :key="topic"
            >{{ topic }}</ElTag>
            <ElTag
              v-for="tag in repository.tags"
              type="primary"
              effect="plain"
              :key="`tag:${tag}`"
            >#{{ tag }}</ElTag>
          </div>
        </div>
      </template>
    </ElTableColumn>

    <ElTableColumn label="语言" width="140">
      <template #default="{ row: repository }">
        <div class="language-cell">
          <span
            class="size-[9px] rounded-full"
            :style="{ backgroundColor: languageColor(repository.language) }"
          />
          {{ repository.language }}
        </div>
      </template>
    </ElTableColumn>

    <ElTableColumn min-width="220" :label="module === 'starred' ? 'Lists' : '可见性与归属'">
      <template #default="{ row: repository }">
        <div v-if="module === 'starred'" class="group-cell">
          <ElButton
            v-for="group in repositoryGroups(repository)"
            text
            class="group-chip !ml-0"
            :key="group.id"
            :style="{ '--chip-color': group.color }"
            :title="`从 ${group.name} 移除`"
            @click="emit('remove-group', repository.id, group.id)"
          >
            {{ group.name }}
            <ElIcon>
              <Close />
            </ElIcon>
          </ElButton>
          <span v-if="!repository.groupIds.length" class="muted">Inbox</span>
        </div>
        <div v-else class="ownership-cell">
          <ElTag effect="plain">{{ repository.visibility }}</ElTag>
          <ElTag type="success" effect="plain">{{ ownershipLabel(repository.ownership) }}</ElTag>
        </div>
      </template>
    </ElTableColumn>

    <ElTableColumn
      align="right"
      label="活跃度"
      width="140"
    >
      <template #default="{ row: repository }">
        <div class="activity-cell">
          <span class="inline-flex items-center gap-1">
            <ElIcon>
              <StarFilled />
            </ElIcon>
            {{ compactNumber(repository.stars) }}
          </span>
          <span class="text-[11px] text-slate-400 dark:text-slate-500">{{ relativeDate(repository.pushedAt) }}</span>
        </div>
      </template>
    </ElTableColumn>

    <template #empty>
      <div class="empty-state">
        <ElIcon>
          <StarFilled />
        </ElIcon>
        <div class="mt-[15px] mb-1.5 text-xl font-bold text-slate-600 dark:text-slate-300">这里还没有仓库</div>
        <div class="text-sm">调整筛选条件，或者同步一次 GitHub 仓库。</div>
      </div>
    </template>
  </ElTable>
</template>

<script setup lang="ts">
import { Close, StarFilled } from '@element-plus/icons-vue'

import type { StarGroup, Repository, RepositoryModule } from '../types'

const props = defineProps<{
  module: RepositoryModule
  repositories: Repository[]
  groups: StarGroup[]
  selectedIds: number[]
  allSelected: boolean
  someSelected: boolean
}>()

const emit = defineEmits<{
  toggle: [id: number]
  'toggle-all': []
  'remove-group': [repositoryId: number, groupId: string]
}>()

const repositoryRowKey = (repository: Repository) => repository.id

const groupMap = () => new Map(props.groups.map(group => [group.id, group]))

const ownershipLabel = (ownership: Repository['ownership']) => ({
  owned: 'Owned',
  organization: 'Organization',
  collaborated: 'Collaborator',
  external: ''
})[ownership]

const repositoryGroups = (repository: Repository) => {
  const map = groupMap()
  return repository.groupIds
    .map(groupId => map.get(groupId))
    .filter((group): group is StarGroup => Boolean(group))
}

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Vue: '#41b883',
  Python: '#3572a5',
  Rust: '#dea584',
  Go: '#00add8',
  Java: '#b07219',
  CSS: '#663399',
  HTML: '#e34c26'
}

const languageColor = (language: string) => languageColors[language] ?? '#94a3b8'

const compactNumber = (value: number) =>
  Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

const relativeDate = (value: string) => {
  if (!value) return '暂无更新'
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  if (days < 1) return '今天更新'
  if (days < 30) return `${days} 天前更新`
  if (days < 365) return `${Math.floor(days / 30)} 个月前更新`
  return `${Math.floor(days / 365)} 年前更新`
}
</script>
