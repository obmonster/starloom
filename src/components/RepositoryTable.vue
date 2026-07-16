<template>
  <div class="repository-table">
    <div class="repository-table__head">
      <label class="checkbox-cell">
        <input
          type="checkbox"
          :checked="allSelected"
          :indeterminate="someSelected && !allSelected"
          @change="emit('toggle-all')"
        />
      </label>
      <span>仓库</span>
      <span>语言</span>
      <span>Lists</span>
      <span>活跃度</span>
    </div>

    <div v-if="!repositories.length" class="empty-state">
      <span>✦</span>
      <h3>这里还没有仓库</h3>
      <p>调整筛选条件，或者同步一次 GitHub Stars。</p>
    </div>

    <article v-for="repository in repositories" :key="repository.id" class="repository-row">
      <label class="checkbox-cell">
        <input
          type="checkbox"
          :checked="selectedIds.includes(repository.id)"
          @change="emit('toggle', repository.id)"
        />
      </label>
      <div class="repository-main">
        <div class="repository-main__title">
          <a target="_blank" rel="noreferrer" :href="repository.htmlUrl">{{ repository.fullName }}</a>
          <span v-if="repository.archived" class="badge badge--warning">Archived</span>
          <span v-if="repository.fork" class="badge">Fork</span>
        </div>
        <p>{{ repository.description || '暂无仓库简介。' }}</p>
        <div v-if="repository.topics.length || repository.tags.length" class="tag-row">
          <span v-for="topic in repository.topics.slice(0, 4)" :key="topic" class="topic-tag">
            {{ topic }}
          </span>
          <span v-for="tag in repository.tags" :key="`tag:${tag}`" class="local-tag">#{{ tag }}</span>
        </div>
      </div>
      <div class="language-cell">
        <i :style="{ backgroundColor: languageColor(repository.language) }" />
        {{ repository.language }}
      </div>
      <div class="group-cell">
        <button
          v-for="group in repositoryGroups(repository)"
          :key="group.id"
          class="group-chip"
          type="button"
          :title="`从 ${group.name} 移除`"
          :style="{ '--chip-color': group.color }"
          @click="emit('remove-group', repository.id, group.id)"
        >
          {{ group.name }} ×
        </button>
        <span v-if="!repository.groupIds.length" class="muted">Inbox</span>
      </div>
      <div class="activity-cell">
        <span>★ {{ compactNumber(repository.stars) }}</span>
        <small>{{ relativeDate(repository.pushedAt) }}</small>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { StarGroup, StarredRepository } from '../types'

const props = defineProps<{
  repositories: StarredRepository[]
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

const groupMap = () => new Map(props.groups.map(group => [group.id, group]))

const repositoryGroups = (repository: StarredRepository) => {
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
