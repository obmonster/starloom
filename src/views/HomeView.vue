<template>
  <div v-if="!initialized" class="app-loading">
    <span class="brand-mark brand-mark--large">
      <ElIcon>
        <StarFilled />
      </ElIcon>
    </span>
    <span>正在打开本地星库…</span>
  </div>

  <div v-else class="app-frame min-h-screen">
    <div class="app-topbar">
      <div class="topbar-brand">
        <span class="brand-mark">
          <ElIcon>
            <StarFilled />
          </ElIcon>
        </span>
        <span class="font-semibold">Starloom</span>
      </div>
      <div class="module-switcher" aria-label="功能模块">
        <ElButton
          text
          class="module-switcher__item"
          :icon="FolderOpened"
          :class="{ 'module-switcher__item--active': activeModule === 'owned' }"
          @click="selectModule('owned')"
        >我的仓库</ElButton>
        <ElButton
          text
          class="module-switcher__item !ml-0"
          :icon="StarFilled"
          :class="{ 'module-switcher__item--active': activeModule === 'starred' }"
          @click="selectModule('starred')"
        >Star 仓库</ElButton>
      </div>
      <div v-if="profile" class="topbar-profile">
        <ElSwitch
          v-model="darkMode"
          inline-prompt
          aria-label="切换深色或浅色主题"
          active-text="暗"
          inactive-text="亮"
          :active-action-icon="Moon"
          :inactive-action-icon="Sunny"
        />
        <ElDropdown trigger="click" @command="handleProfileCommand">
          <ElButton
            text
            class="topbar-avatar"
            title="账户菜单"
          >
            <ElAvatar
              :alt="profile.login"
              :src="profile.avatarUrl"
              :size="34"
            />
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem disabled :icon="User">{{ profile.login }}</ElDropdownItem>
              <ElDropdownItem
                divided
                command="disconnect"
                :icon="SwitchButton"
              >退出登录</ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </div>
    </div>

    <div class="app-shell" :style="{ '--sidebar-width': `${sidebarWidth}px` }">
      <SidebarNav
        :width="sidebarWidth"
        :groups="groups"
        :module="activeModule"
        :fork-count="forkCount"
        :star-count="starCount"
        :active-view="activeView"
        :inbox-count="inboxCount"
        :owned-count="ownedCount"
        :stale-count="staleCount"
        :group-counts="groupCounts"
        :last-sync-at="lastSyncAt"
        :public-count="publicCount"
        :managed-count="managedCount"
        :archived-count="archivedCount"
        :non-public-count="nonPublicCount"
        :collaborated-count="collaboratedCount"
        :organization-count="organizationCount"
        :owned-archived-count="ownedArchivedCount"
        @resize="handleSidebarResize"
        @edit-group="openEditGroup"
        @select-view="activeView = $event"
        @create-group="createGroupVisible = true"
        @delete-group="openDeleteGroup"
      />

      <div class="workspace">
        <div class="mb-[30px] flex items-center justify-end">
          <div class="header-actions">
            <ElButton :icon="Download" @click="exportData">导出</ElButton>
            <ElUpload
              accept="application/json"
              :on-change="importData"
              :auto-upload="false"
              :show-file-list="false"
            >
              <ElButton :icon="Upload">导入</ElButton>
            </ElUpload>
            <ElButton
              type="primary"
              :icon="Refresh"
              :loading="syncing"
              @click="handleSync"
            >{{ syncing ? '同步中…' : activeModule === 'owned' ? '同步我的仓库' : '同步 Stars' }}</ElButton>
          </div>
        </div>

        <div v-if="activeModule === 'owned'" class="lists-boundary" aria-label="GitHub 仓库同步范围">
          <div>
            <span>
              GitHub 仓库已连接：个人 {{ ownedCount }}、组织 {{ organizationCount }}、协作
              {{ collaboratedCount }}，其中非公开仓库 {{ nonPublicCount }} 个。
            </span>
          </div>
          <span>若缺少私有仓库，请为 Token 授予目标私有仓库的读取权限后重新同步。</span>
        </div>

        <div v-else class="lists-boundary" aria-label="GitHub Lists API 状态">
          <div>
            <span>
              GitHub 原生 Lists 已连接：已同步 {{ githubGroupCount }} 个原生 Lists；批量写入会保留仓库已有的其他 Lists。
            </span>
          </div>
          <div>
            <ElButton :icon="Download" @click="exportListsPlan">导出 Lists 备份</ElButton>
            <ElLink
              rel="noreferrer"
              target="_blank"
              underline="never"
              :href="githubListsUrl"
              :icon="Link"
            >打开 GitHub Lists</ElLink>
          </div>
        </div>

        <FilterBar
          v-model:sort="sort"
          v-model:search="search"
          v-model:language="language"
          :module="activeModule"
          :languages="languages"
        />

        <div class="library-panel">
          <div class="library-toolbar">
            <div>
              <ElButton
                v-if="activeModule === 'starred'"
                @click="selectAllFiltered"
              >{{ allFilteredSelected ? '取消全部选择' : `选择当前结果 (${filteredRepositories.length})` }}</ElButton>
              <ElButton
                v-if="activeModule === 'starred' && !isSystemView"
                @click="previewRemoveFilteredFromCurrentGroup"
              >清空当前分组</ElButton>
            </div>
            <span>第 {{ page }} / {{ pageCount }} 页</span>
          </div>

          <RepositoryTable
            :groups="groups"
            :module="activeModule"
            :all-selected="allPageSelected"
            :repositories="pageRepositories"
            :selected-ids="selectedIds"
            :some-selected="somePageSelected"
            @toggle="toggleSelection"
            @toggle-all="toggleCurrentPage"
            @remove-group="handleRemoveGroup"
          />

          <div v-if="filteredRepositories.length" class="pagination">
            <span>{{ rangeStart }}–{{ rangeEnd }} / {{ filteredRepositories.length }}</span>
            <ElPagination
              v-model:current-page="page"
              background
              layout="prev, pager, next"
              :page-count="pageCount"
            />
          </div>
        </div>
      </div>

    <BulkActionBar
      v-if="activeModule === 'starred' && selectedIds.length"
      :groups="groups"
      :starred-count="selectedStarredRepositories.length"
      :selected-count="selectedIds.length"
      @clear="selectedIds = []"
      @unstar="unstarVisible = true"
      @add-tags="handleAddTags"
      @assign-group="handleAssignGroup"
      @auto-classify="handleAutoClassify"
    />

    <ElDialog
      v-model="createGroupVisible"
      append-to-body
      destroy-on-close
      width="500px"
      :title="editingGroupId ? '编辑 List' : '创建 List'"
      :show-close="!publishingGroup && !groupSaving"
      :close-on-click-modal="false"
      :close-on-press-escape="!publishingGroup && !groupSaving"
      @closed="closeCreateGroup"
    >
      <div class="mb-5 text-sm text-slate-500 dark:text-slate-400">名称、描述和可见性会同步到 GitHub；颜色仅用于 Starloom 本地界面。</div>
      <ElForm label-position="top">
        <ElFormItem label="List 名称">
          <ElInput v-model="newGroupName" autofocus placeholder="例如：Vue projects" />
        </ElFormItem>
        <ElFormItem label="List 描述">
          <ElInput
            v-model="newGroupDescription"
            type="textarea"
            placeholder="这个 List 收录哪些仓库？"
            :rows="3"
          />
        </ElFormItem>
        <ElFormItem label="标记颜色">
          <div class="flex items-center gap-3">
            <ElColorPicker v-model="newGroupColor" />
            <span class="font-mono text-sm text-slate-500 dark:text-slate-400">{{ newGroupColor }}</span>
          </div>
        </ElFormItem>
        <ElCheckbox v-model="newGroupPrivate">Private List，仅自己可见</ElCheckbox>
      </ElForm>
      <div v-if="publishingGroup" class="progress-text">
        正在发布并写入仓库关系 {{ publishProgress }}/{{ groupCounts[editingGroupId] ?? 0 }}…
      </div>
      <template #footer>
        <ElButton
          v-if="editingGroup && !editingGroup.githubId"
          :disabled="publishingGroup || groupSaving"
          @click="handlePublishGroup"
        >发布到 GitHub</ElButton>
        <ElButton :disabled="publishingGroup || groupSaving" @click="closeCreateGroup">取消</ElButton>
        <ElButton
          type="primary"
          :loading="groupSaving"
          :disabled="!newGroupName.trim() || publishingGroup"
          @click="handleCreateGroup"
        >{{ editingGroupId ? '保存修改' : '创建 List' }}</ElButton>
      </template>
    </ElDialog>

    <ElDialog
      append-to-body
      destroy-on-close
      width="500px"
      :title="pendingListChange?.action === 'add' ? '确认加入 List' : '确认移出 List'"
      :show-close="!listChangeSaving"
      :model-value="Boolean(pendingListChange)"
      :close-on-click-modal="false"
      :close-on-press-escape="!listChangeSaving"
      @close="closeListChange"
    >
      <div class="mb-5 text-sm text-slate-500 dark:text-slate-400">
        将 {{ pendingListChange?.repositoryIds.length ?? 0 }} 个仓库{{ pendingListChange?.action === 'add' ? '加入' : '移出' }}
        “{{ pendingListGroup?.name }}”。{{ pendingListGroup?.githubId
          ? '已 Star 的仓库会写入 GitHub；未 Star 的自有仓库保留本地关联。'
          : '这是尚未发布的旧本地分组，只会更新本地缓存。' }}
      </div>
      <div class="unstar-preview">
        <span v-for="repository in pendingListRepositories.slice(0, 8)" :key="repository.id">{{ repository.fullName }}</span>
        <span v-if="pendingListRepositories.length > 8">以及其他 {{ pendingListRepositories.length - 8 }} 个仓库</span>
      </div>
      <div v-if="listChangeSaving" class="progress-text">
        正在{{ pendingListGroup?.githubId ? '写入 GitHub' : '更新本地' }}
        {{ listChangeProgress }}/{{ pendingListChange?.repositoryIds.length ?? 0 }}…
      </div>
      <template #footer>
        <ElButton :disabled="listChangeSaving" @click="closeListChange">取消</ElButton>
        <ElButton type="primary" :loading="listChangeSaving" @click="applyListChange">确认更改</ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="autoClassifyVisible"
      append-to-body
      destroy-on-close
      title="自动分类"
      width="500px"
      :show-close="!autoClassifying"
      :close-on-click-modal="false"
      :close-on-press-escape="!autoClassifying"
    >
      <div class="mb-5 text-sm text-slate-500 dark:text-slate-400">
        Starloom 将按语言、Topics 和简介创建缺失的 Lists；已 Star 的仓库写入 GitHub，未 Star 的自有仓库保留本地关联。
      </div>
      <div class="unstar-preview">
        <span v-for="repository in selectedRepositories.slice(0, 8)" :key="repository.id">{{ repository.fullName }}</span>
        <span v-if="selectedRepositories.length > 8">以及其他 {{ selectedRepositories.length - 8 }} 个仓库</span>
      </div>
      <div v-if="autoClassifying" class="progress-text">正在创建并写入 GitHub Lists…</div>
      <template #footer>
        <ElButton :disabled="autoClassifying" @click="closeAutoClassify">取消</ElButton>
        <ElButton type="primary" :loading="autoClassifying" @click="applyAutoClassify">确认自动分类</ElButton>
      </template>
    </ElDialog>

    <ElDialog
      append-to-body
      destroy-on-close
      width="500px"
      :title="`删除 “${deletingGroup?.name ?? ''}”`"
      :show-close="!deletingGroupSaving"
      :model-value="Boolean(deletingGroup)"
      :close-on-click-modal="false"
      :close-on-press-escape="!deletingGroupSaving"
      @close="closeDeleteGroup"
    >
      <div class="text-sm text-slate-500 dark:text-slate-400">
        将从 {{ groupCounts[deletingGroup?.id ?? ''] ?? 0 }} 个仓库移除此 List。{{
          deletingGroup?.githubId ? '同时会从 GitHub 删除原生 List。' : '这个旧分组尚未发布到 GitHub。'
        }}
      </div>
      <template #footer>
        <ElButton :disabled="deletingGroupSaving" @click="closeDeleteGroup">取消</ElButton>
        <ElButton type="danger" :loading="deletingGroupSaving" @click="handleDeleteGroup">删除 List</ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="unstarVisible"
      append-to-body
      destroy-on-close
      width="500px"
      :title="`取消 ${selectedStarredRepositories.length} 个 Stars？`"
      :show-close="!unstarProgress"
      :close-on-click-modal="false"
      :close-on-press-escape="!unstarProgress"
    >
      <div class="mb-5 text-sm text-slate-500 dark:text-slate-400">此操作会直接修改 GitHub。自己的仓库会继续保留在“我的仓库”中。</div>
      <div class="unstar-preview">
        <span v-for="repository in selectedStarredRepositories.slice(0, 8)" :key="repository.id">{{ repository.fullName }}</span>
        <span v-if="selectedStarredRepositories.length > 8">以及其他 {{ selectedStarredRepositories.length - 8 }} 个仓库</span>
      </div>
      <div v-if="unstarProgress" class="progress-text">
        正在处理 {{ unstarProgress }}/{{ selectedStarredRepositories.length }}…
      </div>
      <template #footer>
        <ElButton :disabled="unstarProgress > 0" @click="closeUnstar">取消</ElButton>
        <ElButton type="danger" :loading="unstarProgress > 0" @click="handleUnstar">确认 Unstar</ElButton>
      </template>
    </ElDialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import FilterBar from '../components/FilterBar.vue'
import SidebarNav from '../components/SidebarNav.vue'
import BulkActionBar from '../components/BulkActionBar.vue'
import RepositoryTable from '../components/RepositoryTable.vue'

import { isStale } from '../services/classifier'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useStarStore } from '../stores/starStore'
import { computed, onMounted, ref, watch } from 'vue'
import {
  Download,
  FolderOpened,
  Link,
  Moon,
  Refresh,
  StarFilled,
  Sunny,
  SwitchButton,
  Upload,
  User
} from '@element-plus/icons-vue'

import type { UploadFile } from 'element-plus'
import type { StarGroup, BackupData, RepositoryView, RepositoryModule } from '../types'

const PAGE_SIZE = 20
const ACTIVE_MODULE_KEY = 'starloom.active-module'
const SIDEBAR_WIDTH_KEY = 'starloom.sidebar-width'
const DEFAULT_SIDEBAR_WIDTH = 280
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 360
const ownedSystemViews: RepositoryView[] = [
  'managed',
  'owned',
  'organization',
  'collaborated',
  'public',
  'non-public',
  'forks',
  'owned-archived'
]
const starredSystemViews: RepositoryView[] = [
  'stars',
  'inbox',
  'archived',
  'stale'
]

const clampSidebarWidth = (width: number) =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))

const savedSidebarWidthValue = localStorage.getItem(SIDEBAR_WIDTH_KEY)
const savedSidebarWidth = savedSidebarWidthValue === null ? Number.NaN : Number(savedSidebarWidthValue)
const savedActiveModule = localStorage.getItem(ACTIVE_MODULE_KEY)

const darkMode = defineModel<boolean>('darkMode', { required: true })

const router = useRouter()
const store = useStarStore()
const { repositories, groups, profile, lastSyncAt, syncing, error } =
  storeToRefs(store)

const initialized = ref(false)
const sidebarWidth = ref(
  Number.isFinite(savedSidebarWidth)
    ? clampSidebarWidth(savedSidebarWidth)
    : DEFAULT_SIDEBAR_WIDTH
)
const activeModule = ref<RepositoryModule>(savedActiveModule === 'starred' ? 'starred' : 'owned')
const ownedView = ref<RepositoryView>('managed')
const starredView = ref<RepositoryView>('stars')
const ownedSearch = ref('')
const starredSearch = ref('')
const ownedLanguage = ref('')
const starredLanguage = ref('')
const ownedSort = ref('updated-desc')
const starredSort = ref('starred-desc')
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

const activeView = computed<RepositoryView>({
  get: () => activeModule.value === 'owned' ? ownedView.value : starredView.value,
  set: view => {
    if (activeModule.value === 'owned') ownedView.value = view
    else starredView.value = view
  }
})
const search = computed({
  get: () => activeModule.value === 'owned' ? ownedSearch.value : starredSearch.value,
  set: value => {
    if (activeModule.value === 'owned') ownedSearch.value = value
    else starredSearch.value = value
  }
})
const language = computed({
  get: () => activeModule.value === 'owned' ? ownedLanguage.value : starredLanguage.value,
  set: value => {
    if (activeModule.value === 'owned') ownedLanguage.value = value
    else starredLanguage.value = value
  }
})
const sort = computed({
  get: () => activeModule.value === 'owned' ? ownedSort.value : starredSort.value,
  set: value => {
    if (activeModule.value === 'owned') ownedSort.value = value
    else starredSort.value = value
  }
})

const managedRepositories = computed(() =>
  repositories.value.filter(repository => repository.ownership !== 'external')
)
const starredRepositories = computed(() =>
  repositories.value.filter(repository => repository.isStarred)
)
const moduleRepositories = computed(() =>
  activeModule.value === 'owned' ? managedRepositories.value : starredRepositories.value
)
const managedCount = computed(() => managedRepositories.value.length)
const starCount = computed(() => starredRepositories.value.length)
const inboxCount = computed(() =>
  starredRepositories.value.filter(repository => !repository.groupIds.length).length
)
const ownedCount = computed(
  () => repositories.value.filter(repository => repository.ownership === 'owned').length
)
const organizationCount = computed(
  () => repositories.value.filter(repository => repository.ownership === 'organization').length
)
const collaboratedCount = computed(
  () => repositories.value.filter(repository => repository.ownership === 'collaborated').length
)
const nonPublicCount = computed(
  () => managedRepositories.value.filter(repository => repository.visibility !== 'public').length
)
const publicCount = computed(
  () => managedRepositories.value.filter(repository => repository.visibility === 'public').length
)
const forkCount = computed(
  () => managedRepositories.value.filter(repository => repository.fork).length
)
const ownedArchivedCount = computed(
  () => managedRepositories.value.filter(repository => repository.archived).length
)
const archivedCount = computed(
  () => starredRepositories.value.filter(repository => repository.archived).length
)
const staleCount = computed(() => starredRepositories.value.filter(isStale).length)
const languages = computed(() =>
  [...new Set(moduleRepositories.value.map(repository => repository.language))].sort()
)
const groupCounts = computed(() =>
  Object.fromEntries(
    groups.value.map(group => [
      group.id,
      starredRepositories.value.filter(repository => repository.groupIds.includes(group.id)).length
    ])
  )
)
const isSystemView = computed(() => (
  activeModule.value === 'owned' ? ownedSystemViews : starredSystemViews
).includes(activeView.value))
const currentGroup = computed(() => activeModule.value === 'starred'
  ? groups.value.find(group => group.id === activeView.value)
  : undefined
)
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

const filteredRepositories = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  const result = moduleRepositories.value.filter(repository => {
    if (activeModule.value === 'owned') {
      if (activeView.value === 'owned' && repository.ownership !== 'owned') return false
      if (activeView.value === 'organization' && repository.ownership !== 'organization') return false
      if (activeView.value === 'collaborated' && repository.ownership !== 'collaborated') return false
      if (activeView.value === 'public' && repository.visibility !== 'public') return false
      if (activeView.value === 'non-public' && repository.visibility === 'public') return false
      if (activeView.value === 'forks' && !repository.fork) return false
      if (activeView.value === 'owned-archived' && !repository.archived) return false
    } else {
      if (activeView.value === 'inbox' && repository.groupIds.length) return false
      if (activeView.value === 'archived' && !repository.archived) return false
      if (activeView.value === 'stale' && !isStale(repository)) return false
      if (!isSystemView.value && !repository.groupIds.includes(activeView.value)) return false
    }
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
const selectedStarredRepositories = computed(() =>
  selectedRepositories.value.filter(repository => repository.isStarred)
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

watch(activeModule, module => {
  localStorage.setItem(ACTIVE_MODULE_KEY, module)
}, { immediate: true })

onMounted(async () => {
  await store.initialize()
  initialized.value = true
})

const notify = (message: string, type: 'success' | 'error' = 'success') => {
  ElMessage({ message, type })
}

const selectModule = (module: RepositoryModule) => {
  if (activeModule.value === module) return
  activeModule.value = module
  selectedIds.value = []
}

const handleSidebarResize = (width: number) => {
  sidebarWidth.value = clampSidebarWidth(width)
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth.value))
}

const handleDisconnect = () => {
  store.disconnect()
  selectedIds.value = []
  router.replace({ name: 'login' })
}

const handleProfileCommand = (command: string) => {
  if (command === 'disconnect') handleDisconnect()
}

const handleSync = async () => {
  try {
    await store.syncRepositories()
    notify(activeModule.value === 'owned'
      ? `我的仓库已更新，共 ${managedCount.value} 个，其中 ${nonPublicCount.value} 个非公开仓库`
      : `Star 仓库已更新，共 ${starCount.value} 个，包含 ${githubGroupCount.value} 个 Lists`
    )
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
    if (activeView.value === group.id) activeView.value = 'stars'
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
  const ids = selectedStarredRepositories.value.map(repository => repository.id)
  if (!ids.length) return
  try {
    await store.unstarMany(ids, done => {
      unstarProgress.value = done
    })
    const completedIds = new Set(ids)
    selectedIds.value = selectedIds.value.filter(id => !completedIds.has(id))
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

const importData = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return
  try {
    const backup = JSON.parse(await file.text()) as BackupData
    await store.importBackup(backup)
    selectedIds.value = []
    notify('备份已恢复')
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '导入失败', 'error')
  }
}
</script>
