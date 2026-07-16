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
      @edit-group="openEditGroup"
      @delete-group="openDeleteGroup"
    />

    <main class="workspace">
      <header class="workspace-header">
        <div>
          <p class="eyebrow">GITHUB STARS · LISTS</p>
          <h1>{{ currentViewTitle }}</h1>
          <p>{{ currentGroup?.description || `${filteredRepositories.length} repositories in this view` }}</p>
        </div>
        <div class="header-actions">
          <button class="button" type="button" @click="exportData">↓ 导出</button>
          <label class="button import-button">
            ↑ 导入
            <input ref="importInput" accept="application/json" type="file" @change="importData" />
          </label>
          <button
            class="button button--primary"
            type="button"
            :disabled="syncing"
            @click="handleSync"
          >
            <span :class="{ spinning: syncing }">↻</span>
            {{ syncing ? '同步中…' : '同步 GitHub' }}
          </button>
        </div>
      </header>

      <section class="lists-boundary" aria-label="GitHub Lists API 状态">
        <div>
          <strong>GitHub 原生 Lists 已连接</strong>
          <span>
            已同步 {{ githubGroupCount }} 个原生 Lists；批量写入会保留仓库已有的其他 Lists。
          </span>
        </div>
        <div>
          <button class="button button--compact" type="button" @click="exportListsPlan">
            ↓ 导出 Lists 备份
          </button>
          <a
            class="button button--compact"
            target="_blank"
            rel="noreferrer"
            :href="githubListsUrl"
          >打开 GitHub Lists ↗</a>
        </div>
      </section>

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
              @click="previewRemoveFilteredFromCurrentGroup"
            >
              清空当前分组
            </button>
          </div>
          <span>第 {{ page }} / {{ pageCount }} 页</span>
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
            ← 上一页
          </button>
          <span>{{ rangeStart }}–{{ rangeEnd }} of {{ filteredRepositories.length }}</span>
          <button
            class="button button--compact"
            type="button"
            :disabled="page === pageCount"
            @click="page++"
          >
            下一页 →
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
        <p class="eyebrow">{{ editingGroupId ? 'EDIT GITHUB LIST' : 'NEW GITHUB LIST' }}</p>
        <h2 id="group-title">{{ editingGroupId ? '编辑 List' : '创建 List' }}</h2>
        <p>名称、描述和可见性会同步到 GitHub；颜色仅用于 Starloom 本地界面。</p>
        <label class="field-label">
          List 名称
          <input v-model="newGroupName" autofocus placeholder="例如：Vue projects" />
        </label>
        <label class="field-label">
          List 描述
          <textarea
            v-model="newGroupDescription"
            rows="3"
            placeholder="这个 List 收录哪些仓库？"
          />
        </label>
        <label class="field-label field-label--color">
          标记颜色
          <input v-model="newGroupColor" type="color" />
          <span>{{ newGroupColor }}</span>
        </label>
        <label class="privacy-field">
          <input v-model="newGroupPrivate" type="checkbox" />
          <span>
            <strong>Private List</strong>
            <small>仅自己可见；GitHub 默认为公开 List。</small>
          </span>
        </label>
        <p v-if="publishingGroup" class="progress-text">
          正在发布并写入仓库关系 {{ publishProgress }}/{{ groupCounts[editingGroupId] ?? 0 }}…
        </p>
        <div class="modal-actions">
          <button
            v-if="editingGroup && !editingGroup.githubId"
            class="button"
            type="button"
            :disabled="publishingGroup || groupSaving"
            @click="handlePublishGroup"
          >发布到 GitHub</button>
          <button
            class="button"
            type="button"
            :disabled="publishingGroup || groupSaving"
            @click="closeCreateGroup"
          >取消</button>
          <button
            class="button button--primary"
            type="button"
            :disabled="!newGroupName.trim() || publishingGroup || groupSaving"
            @click="handleCreateGroup"
          >
            {{ editingGroupId ? '保存修改' : '创建 List' }}
          </button>
        </div>
      </section>
    </div>

    <div v-if="pendingListChange" class="modal-backdrop" @click.self="closeListChange">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="list-change-title">
        <p class="eyebrow">LIST CHANGE PREVIEW</p>
        <h2 id="list-change-title">确认{{ pendingListChange.action === 'add' ? '加入' : '移出' }} List？</h2>
        <p>
          将 {{ pendingListChange.repositoryIds.length }} 个仓库{{ pendingListChange.action === 'add' ? '加入' : '移出' }}
          “{{ pendingListGroup?.name }}”。{{ pendingListGroup?.githubId
            ? '变更将逐项写入 GitHub，并保留每个仓库已有的其他 Lists。'
            : '这是尚未发布的旧本地分组，只会更新本地缓存。' }}
        </p>
        <div class="unstar-preview">
          <span v-for="repository in pendingListRepositories.slice(0, 8)" :key="repository.id">
            {{ repository.fullName }}
          </span>
          <small v-if="pendingListRepositories.length > 8">
            以及其他 {{ pendingListRepositories.length - 8 }} 个仓库
          </small>
        </div>
        <p v-if="listChangeSaving" class="progress-text">
          正在{{ pendingListGroup?.githubId ? '写入 GitHub' : '更新本地' }}
          {{ listChangeProgress }}/{{ pendingListChange.repositoryIds.length }}…
        </p>
        <div class="modal-actions">
          <button
            class="button"
            type="button"
            :disabled="listChangeSaving"
            @click="closeListChange"
          >取消</button>
          <button
            class="button button--primary"
            type="button"
            :disabled="listChangeSaving"
            @click="applyListChange"
          >
            确认更改
          </button>
        </div>
      </section>
    </div>

    <div v-if="autoClassifyVisible" class="modal-backdrop" @click.self="closeAutoClassify">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="auto-list-title">
        <p class="eyebrow">AUTO CLASSIFY PREVIEW</p>
        <h2 id="auto-list-title">自动分类 {{ selectedIds.length }} 个仓库？</h2>
        <p>
          Starloom 将按语言、Topics 和简介创建缺失的原生 Lists，并逐项合并写入仓库现有 Lists。
        </p>
        <div class="unstar-preview">
          <span v-for="repository in selectedRepositories.slice(0, 8)" :key="repository.id">
            {{ repository.fullName }}
          </span>
          <small v-if="selectedRepositories.length > 8">
            以及其他 {{ selectedRepositories.length - 8 }} 个仓库
          </small>
        </div>
        <p v-if="autoClassifying" class="progress-text">正在创建并写入 GitHub Lists…</p>
        <div class="modal-actions">
          <button
            class="button"
            type="button"
            :disabled="autoClassifying"
            @click="closeAutoClassify"
          >取消</button>
          <button
            class="button button--primary"
            type="button"
            :disabled="autoClassifying"
            @click="applyAutoClassify"
          >确认自动分类</button>
        </div>
      </section>
    </div>

    <div v-if="deletingGroup" class="modal-backdrop" @click.self="closeDeleteGroup">
      <section class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-list-title">
        <p class="eyebrow eyebrow--danger">DELETE LIST</p>
        <h2 id="delete-list-title">删除 “{{ deletingGroup.name }}”？</h2>
        <p>
          将从 {{ groupCounts[deletingGroup.id] ?? 0 }} 个仓库移除此 List。{{
            deletingGroup.githubId ? '同时会从 GitHub 删除原生 List。' : '这个旧分组尚未发布到 GitHub。'
          }}
        </p>
        <div class="modal-actions">
          <button
            class="button"
            type="button"
            :disabled="deletingGroupSaving"
            @click="closeDeleteGroup"
          >取消</button>
          <button
            class="button button--danger-solid"
            type="button"
            :disabled="deletingGroupSaving"
            @click="handleDeleteGroup"
          >
            删除 List
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

import type { BackupData, RepositoryView, StarGroup } from './types'

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
const editingGroupId = ref('')
const newGroupName = ref('')
const newGroupDescription = ref('')
const newGroupColor = ref('#6d5dfc')
const newGroupPrivate = ref(false)
const deletingGroupId = ref('')
const listChangeProgress = ref(0)
const listChangeSaving = ref(false)
const publishProgress = ref(0)
const publishingGroup = ref(false)
const groupSaving = ref(false)
const deletingGroupSaving = ref(false)
const autoClassifyVisible = ref(false)
const autoClassifying = ref(false)
const pendingListChange = ref<{
  action: 'add' | 'remove'
  groupId: string
  repositoryIds: number[]
}>()
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
const currentGroup = computed(() => groups.value.find(group => group.id === activeView.value))
const editingGroup = computed(() => groups.value.find(group => group.id === editingGroupId.value))
const deletingGroup = computed(() => groups.value.find(group => group.id === deletingGroupId.value))
const pendingListGroup = computed(() =>
  groups.value.find(group => group.id === pendingListChange.value?.groupId)
)
const pendingListRepositories = computed(() => {
  const ids = new Set(pendingListChange.value?.repositoryIds ?? [])
  return repositories.value.filter(repository => ids.has(repository.id))
})
const githubListsUrl = computed(() =>
  profile.value ? `https://github.com/${profile.value.login}?tab=stars` : 'https://github.com/stars'
)
const githubGroupCount = computed(() => groups.value.filter(group => group.githubId).length)
const currentViewTitle = computed(() => {
  const labels: Record<string, string> = {
    all: '全部 GitHub Stars',
    inbox: '待整理仓库',
    archived: '已归档仓库',
    stale: '长期未更新仓库'
  }
  return labels[activeView.value] ?? groups.value.find(group => group.id === activeView.value)?.name ?? 'GitHub Stars'
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

const handleAssignGroup = (groupId: string) => {
  pendingListChange.value = {
    action: 'add',
    groupId,
    repositoryIds: [...selectedIds.value]
  }
}

const handleAddTags = async (tags: string[]) => {
  await store.addTags(selectedIds.value, tags)
  notify(`已添加标签：${tags.join('、')}`)
}

const handleAutoClassify = () => {
  autoClassifyVisible.value = true
}

const closeAutoClassify = () => {
  if (autoClassifying.value) return
  autoClassifyVisible.value = false
}

const applyAutoClassify = async () => {
  autoClassifying.value = true
  try {
    const count = await store.autoClassify(selectedIds.value)
    autoClassifyVisible.value = false
    notify(`规则分类完成，已写入 ${count} 个仓库`)
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '自动分类写入失败', 'error')
  } finally {
    autoClassifying.value = false
  }
}

const handleRemoveGroup = (repositoryId: number, groupId: string) => {
  pendingListChange.value = {
    action: 'remove',
    groupId,
    repositoryIds: [repositoryId]
  }
}

const previewRemoveFilteredFromCurrentGroup = () => {
  if (isSystemView.value) return
  pendingListChange.value = {
    action: 'remove',
    groupId: activeView.value,
    repositoryIds: filteredRepositories.value.map(repository => repository.id)
  }
}

const closeListChange = () => {
  if (listChangeSaving.value) return
  pendingListChange.value = undefined
}

const applyListChange = async () => {
  const change = pendingListChange.value
  const group = pendingListGroup.value
  if (!change || !group) return

  listChangeSaving.value = true
  try {
    const onProgress = (done: number) => {
      listChangeProgress.value = done
    }
    if (change.action === 'add') {
      await store.assignGroup(change.repositoryIds, change.groupId, onProgress)
    } else {
      await store.removeGroup(change.repositoryIds, change.groupId, onProgress)
    }
    pendingListChange.value = undefined
    notify(
      `已将 ${change.repositoryIds.length} 个仓库${change.action === 'add' ? '加入' : '移出'} ${group.name}`
    )
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : 'GitHub Lists 写入失败', 'error')
  } finally {
    listChangeProgress.value = 0
    listChangeSaving.value = false
  }
}

const closeCreateGroup = () => {
  if (publishingGroup.value || groupSaving.value) return
  createGroupVisible.value = false
  editingGroupId.value = ''
  newGroupName.value = ''
  newGroupDescription.value = ''
  newGroupColor.value = '#6d5dfc'
  newGroupPrivate.value = false
}

const openEditGroup = (groupId: string) => {
  const group = groups.value.find(item => item.id === groupId)
  if (!group) return
  editingGroupId.value = group.id
  newGroupName.value = group.name
  newGroupDescription.value = group.description ?? ''
  newGroupColor.value = group.color
  newGroupPrivate.value = group.isPrivate ?? false
  createGroupVisible.value = true
}

const openDeleteGroup = (groupId: string) => {
  deletingGroupId.value = groupId
}

const closeDeleteGroup = () => {
  if (deletingGroupSaving.value) return
  deletingGroupId.value = ''
}

const handlePublishGroup = async () => {
  const group = editingGroup.value
  if (!group || group.githubId) return
  publishingGroup.value = true
  try {
    await store.updateGroup(group.id, {
      name: newGroupName.value,
      description: newGroupDescription.value,
      isPrivate: newGroupPrivate.value,
      color: newGroupColor.value
    })
    const published = await store.publishGroup(group.id, done => {
      publishProgress.value = done
    })
    publishingGroup.value = false
    closeCreateGroup()
    notify(`已将 “${published.name}” 发布到 GitHub Lists`)
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '发布 GitHub List 失败', 'error')
  } finally {
    publishProgress.value = 0
    publishingGroup.value = false
  }
}

const handleCreateGroup = async () => {
  groupSaving.value = true
  try {
    const group = editingGroupId.value
      ? await store.updateGroup(editingGroupId.value, {
          name: newGroupName.value,
          description: newGroupDescription.value,
          isPrivate: newGroupPrivate.value,
          color: newGroupColor.value
        })
      : await store.createGroup(
          newGroupName.value,
          newGroupColor.value,
          newGroupDescription.value,
          newGroupPrivate.value
        )
    if (!editingGroupId.value && selectedIds.value.length) {
      await store.assignGroup(selectedIds.value, group.id)
    }
    activeView.value = group.id
    const action = editingGroupId.value ? '已更新' : '已创建'
    groupSaving.value = false
    closeCreateGroup()
    notify(`${action} List “${group.name}”`)
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '保存 List 失败', 'error')
  } finally {
    groupSaving.value = false
  }
}

const handleDeleteGroup = async () => {
  const group = deletingGroup.value
  if (!group) return
  deletingGroupSaving.value = true
  try {
    await store.deleteGroup(group.id)
    if (activeView.value === group.id) activeView.value = 'all'
    deletingGroupId.value = ''
    notify(`已删除 List “${group.name}”`)
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '删除 GitHub List 失败', 'error')
  } finally {
    deletingGroupSaving.value = false
  }
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

const exportListsPlan = () => {
  const targetGroups: StarGroup[] = currentGroup.value ? [currentGroup.value] : groups.value
  const lines = [
    '# Starloom · GitHub Lists 备份',
    '',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `GitHub 账号：${profile.value?.login ?? 'unknown'}`,
    '',
    '> 此文件是当前 GitHub Lists 本地缓存的可读备份，可用于复核同步结果。',
    ''
  ]

  for (const group of targetGroups) {
    const items = repositories.value
      .filter(repository => repository.groupIds.includes(group.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
    lines.push(`## ${group.name}`, '')
    if (group.description) lines.push(group.description, '')
    lines.push(`仓库数量：${items.length}`, '')
    lines.push(...items.map(repository => `- [${repository.fullName}](${repository.htmlUrl})`), '')
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `starloom-lists-plan-${new Date().toISOString().slice(0, 10)}.md`
  anchor.click()
  URL.revokeObjectURL(url)
  notify(`已导出 ${targetGroups.length} 个 Lists 的可读备份`)
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
