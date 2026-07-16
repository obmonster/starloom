<template>
  <div v-if="!initialized" class="app-loading">
    <span class="brand-mark brand-mark--large">✦</span>
    <p>正在打开本地星库…</p>
  </div>

  <TokenSetup
    v-else-if="!token"
    :error="error"
    :loading="loading"
    @connect="handleConnect"
  />

  <div v-else class="app-shell">
    <SidebarNav
      :groups="groups"
      :profile="profile"
      :stale-count="staleCount"
      :total-count="repositories.length"
      :group-counts="groupCounts"
      :active-view="activeView"
      :inbox-count="inboxCount"
      :last-sync-at="lastSyncAt"
      :archived-count="archivedCount"
      @disconnect="handleDisconnect"
      @select-view="activeView = $event"
      @create-group="createGroupVisible = true"
    />

    <main class="workspace">
      <header class="workspace-header">
        <div>
          <p class="eyebrow">YOUR GITHUB LIBRARY</p>
          <h1>{{ currentViewTitle }}</h1>
          <p>{{ filteredRepositories.length }} repositories in this view</p>
        </div>
        <div class="header-actions">
          <button class="button" type="button" @click="exportData">↓ Export</button>
          <label class="button import-button">
            ↑ Import
            <input ref="importInput" accept="application/json" type="file" @change="importData" />
          </label>
          <button
            class="button button--primary"
            type="button"
            :disabled="syncing"
            @click="handleSync"
          >
            <span :class="{ spinning: syncing }">↻</span>
            {{ syncing ? 'Syncing…' : 'Sync GitHub' }}
          </button>
        </div>
      </header>

      <FilterBar
        v-model:sort="sort"
        v-model:search="search"
        v-model:language="language"
        :languages="languages"
      />

      <section class="library-panel">
        <div class="library-toolbar">
          <div>
            <button class="button button--compact" type="button" @click="selectAllFiltered">
              {{ allFilteredSelected ? '取消全部选择' : `选择当前结果 (${filteredRepositories.length})` }}
            </button>
            <button
              v-if="activeView !== 'all' && !isSystemView"
              class="button button--compact"
              type="button"
              @click="removeFilteredFromCurrentGroup"
            >
              清空当前分组
            </button>
          </div>
          <span>Page {{ page }} of {{ pageCount }}</span>
        </div>

        <RepositoryTable
          :groups="groups"
          :repositories="pageRepositories"
          :selected-ids="selectedIds"
          :all-selected="allPageSelected"
          :some-selected="somePageSelected"
          @toggle="toggleSelection"
          @toggle-all="toggleCurrentPage"
          @remove-group="handleRemoveGroup"
        />

        <footer v-if="filteredRepositories.length" class="pagination">
          <button class="button button--compact" type="button" :disabled="page === 1" @click="page--">
            ← Previous
          </button>
          <span>{{ rangeStart }}–{{ rangeEnd }} of {{ filteredRepositories.length }}</span>
          <button
            class="button button--compact"
            type="button"
            :disabled="page === pageCount"
            @click="page++"
          >
            Next →
          </button>
        </footer>
      </section>
    </main>

    <BulkActionBar
      v-if="selectedIds.length"
      :groups="groups"
      :selected-count="selectedIds.length"
      @clear="selectedIds = []"
      @unstar="unstarVisible = true"
      @add-tags="handleAddTags"
      @assign-group="handleAssignGroup"
      @auto-classify="handleAutoClassify"
    />

    <div v-if="createGroupVisible" class="modal-backdrop" @click.self="closeCreateGroup">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="group-title">
        <p class="eyebrow">NEW COLLECTION</p>
        <h2 id="group-title">创建分组</h2>
        <p>分组保存在本地，一个仓库可以属于多个分组。</p>
        <label class="field-label">
          分组名称
          <input v-model="newGroupName" autofocus placeholder="例如：Vue projects" />
        </label>
        <label class="field-label field-label--color">
          标记颜色
          <input v-model="newGroupColor" type="color" />
          <span>{{ newGroupColor }}</span>
        </label>
        <div class="modal-actions">
          <button class="button" type="button" @click="closeCreateGroup">取消</button>
          <button
            class="button button--primary"
            type="button"
            :disabled="!newGroupName.trim()"
            @click="handleCreateGroup"
          >
            创建分组
          </button>
        </div>
      </section>
    </div>

    <div v-if="unstarVisible" class="modal-backdrop" @click.self="closeUnstar">
      <section class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="unstar-title">
        <p class="eyebrow eyebrow--danger">DESTRUCTIVE ACTION</p>
        <h2 id="unstar-title">取消 {{ selectedIds.length }} 个 Stars？</h2>
        <p>此操作会直接修改 GitHub。已取消的仓库也会从 Starloom 本地数据库移除。</p>
        <div class="unstar-preview">
          <span v-for="repository in selectedRepositories.slice(0, 8)" :key="repository.id">
            {{ repository.fullName }}
          </span>
          <small v-if="selectedRepositories.length > 8">
            以及其他 {{ selectedRepositories.length - 8 }} 个仓库
          </small>
        </div>
        <p v-if="unstarProgress" class="progress-text">
          正在处理 {{ unstarProgress }}/{{ selectedIds.length }}…
        </p>
        <div class="modal-actions">
          <button class="button" type="button" :disabled="unstarProgress > 0" @click="closeUnstar">
            取消
          </button>
          <button
            class="button button--danger-solid"
            type="button"
            :disabled="unstarProgress > 0"
            @click="handleUnstar"
          >
            确认 Unstar
          </button>
        </div>
      </section>
    </div>

    <div v-if="toast" class="toast" :class="`toast--${toast.type}`">{{ toast.message }}</div>
  </div>
</template>

<script setup lang="ts">
import BulkActionBar from './components/BulkActionBar.vue'
import FilterBar from './components/FilterBar.vue'
import RepositoryTable from './components/RepositoryTable.vue'
import SidebarNav from './components/SidebarNav.vue'
import TokenSetup from './components/TokenSetup.vue'

import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { isStale } from './services/classifier'
import { useStarStore } from './stores/starStore'

import type { BackupData, RepositoryView } from './types'

const PAGE_SIZE = 20
const systemViews: RepositoryView[] = ['all', 'inbox', 'archived', 'stale']

const store = useStarStore()
const { repositories, groups, profile, token, lastSyncAt, loading, syncing, error } =
  storeToRefs(store)

const initialized = ref(false)
const activeView = ref<RepositoryView>('all')
const search = ref('')
const language = ref('')
const sort = ref('starred-desc')
const page = ref(1)
const selectedIds = ref<number[]>([])
const createGroupVisible = ref(false)
const newGroupName = ref('')
const newGroupColor = ref('#6d5dfc')
const unstarVisible = ref(false)
const unstarProgress = ref(0)
const importInput = ref<HTMLInputElement>()
const toast = ref<{ message: string; type: 'success' | 'error' }>()
let toastTimer: ReturnType<typeof setTimeout> | undefined

const inboxCount = computed(
  () => repositories.value.filter(repository => !repository.groupIds.length).length
)
const archivedCount = computed(
  () => repositories.value.filter(repository => repository.archived).length
)
const staleCount = computed(() => repositories.value.filter(isStale).length)
const languages = computed(() =>
  [...new Set(repositories.value.map(repository => repository.language))].sort()
)
const groupCounts = computed(() =>
  Object.fromEntries(
    groups.value.map(group => [
      group.id,
      repositories.value.filter(repository => repository.groupIds.includes(group.id)).length
    ])
  )
)
const isSystemView = computed(() => systemViews.includes(activeView.value))
const currentViewTitle = computed(() => {
  const labels: Record<string, string> = {
    all: 'All stars',
    inbox: 'Inbox',
    archived: 'Archived repositories',
    stale: 'Stale repositories'
  }
  return labels[activeView.value] ?? groups.value.find(group => group.id === activeView.value)?.name ?? 'Stars'
})

const filteredRepositories = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  const result = repositories.value.filter(repository => {
    if (activeView.value === 'inbox' && repository.groupIds.length) return false
    if (activeView.value === 'archived' && !repository.archived) return false
    if (activeView.value === 'stale' && !isStale(repository)) return false
    if (!isSystemView.value && !repository.groupIds.includes(activeView.value)) return false
    if (language.value && repository.language !== language.value) return false
    if (!keyword) return true

    const searchable = [
      repository.fullName,
      repository.description,
      repository.language,
      ...repository.topics,
      ...repository.tags
    ]
      .join(' ')
      .toLowerCase()
    return searchable.includes(keyword)
  })

  return result.sort((a, b) => {
    switch (sort.value) {
      case 'updated-desc':
        return b.pushedAt.localeCompare(a.pushedAt)
      case 'stars-desc':
        return b.stars - a.stars
      case 'name-asc':
        return a.fullName.localeCompare(b.fullName)
      default:
        return b.starredAt.localeCompare(a.starredAt)
    }
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredRepositories.value.length / PAGE_SIZE)))
const pageRepositories = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredRepositories.value.slice(start, start + PAGE_SIZE)
})
const rangeStart = computed(() => (filteredRepositories.value.length ? (page.value - 1) * PAGE_SIZE + 1 : 0))
const rangeEnd = computed(() => Math.min(page.value * PAGE_SIZE, filteredRepositories.value.length))
const selectedSet = computed(() => new Set(selectedIds.value))
const selectedRepositories = computed(() =>
  repositories.value.filter(repository => selectedSet.value.has(repository.id))
)
const allPageSelected = computed(
  () =>
    Boolean(pageRepositories.value.length) &&
    pageRepositories.value.every(repository => selectedSet.value.has(repository.id))
)
const somePageSelected = computed(() =>
  pageRepositories.value.some(repository => selectedSet.value.has(repository.id))
)
const allFilteredSelected = computed(
  () =>
    Boolean(filteredRepositories.value.length) &&
    filteredRepositories.value.every(repository => selectedSet.value.has(repository.id))
)

watch([activeView, search, language, sort], () => {
  page.value = 1
})

onMounted(async () => {
  await store.initialize()
  initialized.value = true
})

const notify = (message: string, type: 'success' | 'error' = 'success') => {
  toast.value = { message, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = undefined
  }, 3200)
}

const handleConnect = async (nextToken: string) => {
  try {
    await store.connect(nextToken)
    await store.syncStars()
    notify(`已同步 ${repositories.value.length} 个 Stars`)
  } catch {
    notify(error.value || '连接失败', 'error')
  }
}

const handleDisconnect = () => {
  store.disconnect()
  selectedIds.value = []
}

const handleSync = async () => {
  try {
    await store.syncStars()
    notify(`同步完成，共 ${repositories.value.length} 个 Stars`)
  } catch {
    notify(error.value || '同步失败', 'error')
  }
}

const toggleSelection = (id: number) => {
  selectedIds.value = selectedSet.value.has(id)
    ? selectedIds.value.filter(item => item !== id)
    : [...selectedIds.value, id]
}

const toggleCurrentPage = () => {
  const pageIds = new Set(pageRepositories.value.map(repository => repository.id))
  selectedIds.value = allPageSelected.value
    ? selectedIds.value.filter(id => !pageIds.has(id))
    : [...new Set([...selectedIds.value, ...pageIds])]
}

const selectAllFiltered = () => {
  const filteredIds = new Set(filteredRepositories.value.map(repository => repository.id))
  selectedIds.value = allFilteredSelected.value
    ? selectedIds.value.filter(id => !filteredIds.has(id))
    : [...new Set([...selectedIds.value, ...filteredIds])]
}

const handleAssignGroup = async (groupId: string) => {
  await store.assignGroup(selectedIds.value, groupId)
  notify(`已将 ${selectedIds.value.length} 个仓库加入分组`)
}

const handleAddTags = async (tags: string[]) => {
  await store.addTags(selectedIds.value, tags)
  notify(`已添加标签：${tags.join('、')}`)
}

const handleAutoClassify = async () => {
  const count = await store.autoClassify(selectedIds.value)
  notify(`规则分类完成，处理了 ${count} 个仓库`)
}

const handleRemoveGroup = async (repositoryId: number, groupId: string) => {
  await store.removeGroup([repositoryId], groupId)
}

const removeFilteredFromCurrentGroup = async () => {
  if (isSystemView.value) return
  await store.removeGroup(
    filteredRepositories.value.map(repository => repository.id),
    activeView.value
  )
  notify('当前筛选结果已移出分组')
}

const closeCreateGroup = () => {
  createGroupVisible.value = false
  newGroupName.value = ''
}

const handleCreateGroup = async () => {
  const group = await store.createGroup(newGroupName.value, newGroupColor.value)
  if (selectedIds.value.length) await store.assignGroup(selectedIds.value, group.id)
  activeView.value = group.id
  closeCreateGroup()
  notify(`分组 ${group.name} 已创建`)
}

const closeUnstar = () => {
  if (unstarProgress.value) return
  unstarVisible.value = false
}

const handleUnstar = async () => {
  const ids = [...selectedIds.value]
  try {
    await store.unstarMany(ids, done => {
      unstarProgress.value = done
    })
    selectedIds.value = []
    unstarVisible.value = false
    notify(`已取消 ${ids.length} 个 Stars`)
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : 'Unstar 失败', 'error')
  } finally {
    unstarProgress.value = 0
  }
}

const exportData = () => {
  const blob = new Blob([JSON.stringify(store.exportBackup(), null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `starloom-backup-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  notify('备份已导出')
}

const importData = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const backup = JSON.parse(await file.text()) as BackupData
    await store.importBackup(backup)
    selectedIds.value = []
    notify('备份已恢复')
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '导入失败', 'error')
  } finally {
    if (importInput.value) importInput.value.value = ''
  }
}
</script>
