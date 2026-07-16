import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { db } from '../db'
import { classificationRules, suggestGroups } from '../services/classifier'
import {
  createGitHubList,
  deleteGitHubList,
  fetchAllStars,
  fetchGitHubLists,
  fetchProfile,
  unstarRepository,
  updateGitHubList,
  updateGitHubListsForRepository
} from '../services/github'

import type {
  BackupData,
  GitHubList,
  GitHubProfile,
  StarGroup,
  StarredRepository
} from '../types'

const TOKEN_KEY = 'starloom.github-token'
const PROFILE_KEY = 'starloom.github-profile'
const LIST_COLORS = ['#6d5dfc', '#0f9f8f', '#d97706', '#db2777', '#2563eb', '#7c3aed']

const listColor = (id: string) => {
  const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0)
  return LIST_COLORS[hash % LIST_COLORS.length]
}

const cloneRepository = (
  repository: StarredRepository,
  changes: Partial<StarredRepository> = {}
): StarredRepository => {
  const merged = { ...repository, ...changes }
  return {
    ...merged,
    topics: [...merged.topics],
    groupIds: [...merged.groupIds],
    tags: [...merged.tags]
  }
}

const cloneGroup = (group: StarGroup): StarGroup => ({ ...group })

const mergeRepository = (
  incoming: StarredRepository,
  existing: StarredRepository | undefined,
  githubGroupIds: string[],
  previousGitHubGroupIds: Set<string>
): StarredRepository => ({
  ...cloneRepository(incoming, {
    status: existing?.status ?? incoming.status,
    groupIds: [
      ...(existing?.groupIds.filter(groupId => !previousGitHubGroupIds.has(groupId)) ?? []),
      ...githubGroupIds
    ],
    tags: existing?.tags ?? []
  })
})

const mapGitHubList = (list: GitHubList, existing?: StarGroup): StarGroup => ({
  id: existing?.id ?? list.id,
  githubId: list.id,
  name: list.name,
  description: list.description,
  isPrivate: list.isPrivate,
  color: existing?.color ?? listColor(list.id),
  createdAt: list.createdAt,
  updatedAt: list.updatedAt
})

export const useStarStore = defineStore('stars', () => {
  const repositories = ref<StarredRepository[]>([])
  const groups = ref<StarGroup[]>([])
  const profile = ref<GitHubProfile>()
  const token = ref(localStorage.getItem(TOKEN_KEY) ?? '')
  const lastSyncAt = ref('')
  const loading = ref(false)
  const syncing = ref(false)
  const error = ref('')

  const repositoryMap = computed(
    () => new Map(repositories.value.map(repository => [repository.id, repository]))
  )

  async function initialize() {
    loading.value = true
    try {
      const [savedRepositories, savedGroups, syncSetting] = await Promise.all([
        db.repositories.toArray(),
        db.groups.toArray(),
        db.settings.get('lastSyncAt')
      ])
      repositories.value = savedRepositories
      groups.value = savedGroups.sort((a, b) => a.name.localeCompare(b.name))
      lastSyncAt.value = syncSetting?.value ?? ''

      const savedProfile = localStorage.getItem(PROFILE_KEY)
      if (savedProfile) profile.value = JSON.parse(savedProfile) as GitHubProfile
    } finally {
      loading.value = false
    }
  }

  async function connect(nextToken: string) {
    loading.value = true
    error.value = ''
    try {
      const nextProfile = await fetchProfile(nextToken.trim())
      token.value = nextToken.trim()
      profile.value = nextProfile
      localStorage.setItem(TOKEN_KEY, token.value)
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile))
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'GitHub 连接失败'
      throw cause
    } finally {
      loading.value = false
    }
  }

  function disconnect() {
    token.value = ''
    profile.value = undefined
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(PROFILE_KEY)
  }

  async function syncStars() {
    if (!token.value) throw new Error('请先连接 GitHub')

    syncing.value = true
    error.value = ''
    try {
      const [incoming, githubLists] = await Promise.all([
        fetchAllStars(token.value),
        fetchGitHubLists(token.value)
      ])
      const existing = new Map(repositories.value.map(repository => [repository.id, repository]))
      const previousGitHubGroupIds = new Set(
        groups.value.filter(group => group.githubId).map(group => group.id)
      )
      const existingGitHubGroups = new Map(
        groups.value.filter(group => group.githubId).map(group => [group.githubId!, group])
      )
      const localGroups = groups.value.filter(group => !group.githubId).map(cloneGroup)
      const nextGitHubGroups = githubLists.map(list =>
        mapGitHubList(list, existingGitHubGroups.get(list.id))
      )
      const groupIdByGitHubId = new Map(
        nextGitHubGroups.map(group => [group.githubId!, group.id])
      )
      const memberships = new Map<string, string[]>()
      for (const list of githubLists) {
        for (const repositoryNodeId of list.repositoryNodeIds) {
          const listIds = memberships.get(repositoryNodeId) ?? []
          listIds.push(groupIdByGitHubId.get(list.id) ?? list.id)
          memberships.set(repositoryNodeId, listIds)
        }
      }
      const merged = incoming.map(repository =>
        mergeRepository(
          repository,
          existing.get(repository.id),
          memberships.get(repository.nodeId) ?? [],
          previousGitHubGroupIds
        )
      )
      const incomingIds = new Set(merged.map(repository => repository.id))
      const removedIds = repositories.value
        .filter(repository => !incomingIds.has(repository.id))
        .map(repository => repository.id)

      const nextGroups = [...localGroups, ...nextGitHubGroups].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      await db.transaction('rw', db.repositories, db.groups, db.settings, async () => {
        await db.repositories.bulkPut(merged)
        if (removedIds.length) await db.repositories.bulkDelete(removedIds)
        await db.groups.clear()
        if (nextGroups.length) await db.groups.bulkPut(nextGroups)
        const now = new Date().toISOString()
        await db.settings.put({ key: 'lastSyncAt', value: now })
        lastSyncAt.value = now
      })
      repositories.value = merged
      groups.value = nextGroups
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '同步失败'
      throw cause
    } finally {
      syncing.value = false
    }
  }

  async function createGroup(
    name: string,
    color = '#6d5dfc',
    description = '',
    isPrivate = false
  ): Promise<StarGroup> {
    if (!token.value) throw new Error('请先连接 GitHub')
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('List 名称不能为空')
    const existing = groups.value.find(
      group => group.name.toLowerCase() === normalizedName.toLowerCase()
    )
    if (existing) throw new Error(`List “${normalizedName}” 已存在`)

    const list = await createGitHubList(
      token.value,
      normalizedName,
      description.trim(),
      isPrivate
    )
    const group: StarGroup = {
      ...mapGitHubList(list),
      color
    }
    await db.groups.put(cloneGroup(group))
    groups.value = [...groups.value, group].sort((a, b) => a.name.localeCompare(b.name))
    return group
  }

  async function updateGroup(
    groupId: string,
    changes: Pick<StarGroup, 'name' | 'color' | 'description' | 'isPrivate'>
  ): Promise<StarGroup> {
    const group = groups.value.find(item => item.id === groupId)
    if (!group) throw new Error('List 不存在或已被删除')

    const normalizedName = changes.name.trim()
    if (!normalizedName) throw new Error('List 名称不能为空')
    const duplicate = groups.value.find(
      item => item.id !== groupId && item.name.toLowerCase() === normalizedName.toLowerCase()
    )
    if (duplicate) throw new Error(`List “${normalizedName}” 已存在`)

    const description = changes.description?.trim() ?? ''
    const isPrivate = changes.isPrivate ?? false
    const remote = group.githubId
      ? await updateGitHubList(
          token.value,
          group.githubId,
          normalizedName,
          description,
          isPrivate
        )
      : undefined
    const updated: StarGroup = remote
      ? { ...mapGitHubList(remote, group), color: changes.color }
      : {
          ...group,
          name: normalizedName,
          description,
          isPrivate,
          color: changes.color,
          updatedAt: new Date().toISOString()
        }
    await db.groups.put(cloneGroup(updated))
    groups.value = groups.value
      .map(item => (item.id === groupId ? updated : item))
      .sort((a, b) => a.name.localeCompare(b.name))
    return updated
  }

  async function publishGroup(groupId: string, onProgress?: (done: number) => void) {
    const group = groups.value.find(item => item.id === groupId)
    if (!group) throw new Error('List 不存在或已被删除')
    if (group.githubId) return group

    const list = await createGitHubList(
      token.value,
      group.name,
      group.description ?? '',
      group.isPrivate ?? false
    )
    const published: StarGroup = {
      ...mapGitHubList(list, group),
      id: group.id,
      color: group.color
    }
    await db.groups.put(cloneGroup(published))
    groups.value = groups.value.map(item => (item.id === group.id ? published : item))

    const targets = repositories.value.filter(repository => repository.groupIds.includes(group.id))
    let done = 0
    try {
      for (const repository of targets) {
        if (!repository.nodeId) throw new Error(`仓库 ${repository.fullName} 缺少 Node ID，请先同步`)
        await updateGitHubListsForRepository(
          token.value,
          repository.nodeId,
          githubListIds(repository.groupIds)
        )
        done++
        onProgress?.(done)
      }
    } catch (cause) {
      try {
        await deleteGitHubList(token.value, list.id)
        await db.groups.put(cloneGroup(group))
        groups.value = groups.value.map(item => (item.id === group.id ? group : item))
      } catch {
        throw new Error('发布部分完成且自动回滚失败，请立即重新同步 GitHub Lists')
      }
      throw cause
    }
    return published
  }

  async function deleteGroup(groupId: string) {
    const group = groups.value.find(item => item.id === groupId)
    if (!group) return
    if (group.githubId) await deleteGitHubList(token.value, group.githubId)

    const affected = repositories.value
      .filter(repository => repository.groupIds.includes(groupId))
      .map(repository => {
        const groupIds = repository.groupIds.filter(id => id !== groupId)
        return cloneRepository(repository, {
          status: groupIds.length ? repository.status : ('inbox' as const),
          groupIds
        })
      })

    await db.transaction('rw', db.repositories, db.groups, async () => {
      if (affected.length) await db.repositories.bulkPut(affected)
      await db.groups.delete(groupId)
    })
    const affectedMap = new Map(affected.map(repository => [repository.id, repository]))
    repositories.value = repositories.value.map(
      repository => affectedMap.get(repository.id) ?? repository
    )
    groups.value = groups.value.filter(group => group.id !== groupId)
  }

  const githubListIds = (groupIds: string[]) =>
    groups.value.flatMap(group =>
      group.githubId && groupIds.includes(group.id) ? [group.githubId] : []
    )

  async function writeRepositoryGroups(
    repository: StarredRepository,
    groupIds: string[]
  ): Promise<StarredRepository> {
    const currentListIds = githubListIds(repository.groupIds).sort()
    const nextListIds = githubListIds(groupIds).sort()
    if (currentListIds.join('\0') !== nextListIds.join('\0')) {
      if (!repository.nodeId) throw new Error(`仓库 ${repository.fullName} 缺少 Node ID，请先同步`)
      await updateGitHubListsForRepository(token.value, repository.nodeId, nextListIds)
    }
    const updated = cloneRepository(repository, {
      status: groupIds.length ? 'organized' : 'inbox',
      groupIds
    })
    await db.repositories.put(updated)
    return updated
  }

  async function changeGroup(
    ids: number[],
    groupId: string,
    action: 'add' | 'remove',
    onProgress?: (done: number) => void
  ) {
    const targets = ids
      .map(id => repositoryMap.value.get(id))
      .filter((repository): repository is StarredRepository => Boolean(repository))
    const completed: StarredRepository[] = []
    try {
      for (const repository of targets) {
        const groupIds = action === 'add'
          ? [...new Set([...repository.groupIds, groupId])]
          : repository.groupIds.filter(id => id !== groupId)
        completed.push(await writeRepositoryGroups(repository, groupIds))
        onProgress?.(completed.length)
      }
    } finally {
      const updateMap = new Map(completed.map(repository => [repository.id, repository]))
      repositories.value = repositories.value.map(
        repository => updateMap.get(repository.id) ?? repository
      )
    }
  }

  async function assignGroup(ids: number[], groupId: string, onProgress?: (done: number) => void) {
    await changeGroup(ids, groupId, 'add', onProgress)
  }

  async function removeGroup(ids: number[], groupId: string, onProgress?: (done: number) => void) {
    await changeGroup(ids, groupId, 'remove', onProgress)
  }

  async function addTags(ids: number[], nextTags: string[]) {
    const cleanTags = nextTags.map(tag => tag.trim()).filter(Boolean)
    const updates = ids
      .map(id => repositoryMap.value.get(id))
      .filter((repository): repository is StarredRepository => Boolean(repository))
      .map(repository => cloneRepository(repository, {
        tags: [...new Set([...repository.tags, ...cleanTags])]
      }))
    await db.repositories.bulkPut(updates)
    const updateMap = new Map(updates.map(repository => [repository.id, repository]))
    repositories.value = repositories.value.map(repository => updateMap.get(repository.id) ?? repository)
  }

  async function autoClassify(ids: number[]): Promise<number> {
    const targetRepositories = ids
      .map(id => repositoryMap.value.get(id))
      .filter((repository): repository is StarredRepository => Boolean(repository))
    const groupByName = new Map(groups.value.map(group => [group.name, group]))
    const suggestionsByRepository = new Map(
      targetRepositories.map(repository => [repository.id, suggestGroups(repository)])
    )
    const requiredGroupNames = new Set(
      [...suggestionsByRepository.values()].flatMap(suggestions =>
        suggestions.map(rule => rule.group)
      )
    )

    for (const rule of classificationRules) {
      if (requiredGroupNames.has(rule.group) && !groupByName.has(rule.group)) {
        groupByName.set(rule.group, await createGroup(rule.group, rule.color))
      }
    }

    const completed: StarredRepository[] = []
    let classified = 0
    try {
      for (const repository of targetRepositories) {
        const suggestedIds = (suggestionsByRepository.get(repository.id) ?? [])
          .map(rule => groupByName.get(rule.group)?.id)
          .filter((id): id is string => Boolean(id))
        if (!suggestedIds.length) continue
        const groupIds = [...new Set([...repository.groupIds, ...suggestedIds])]
        completed.push(await writeRepositoryGroups(repository, groupIds))
        classified++
      }
    } finally {
      const updateMap = new Map(completed.map(repository => [repository.id, repository]))
      repositories.value = repositories.value.map(
        repository => updateMap.get(repository.id) ?? repository
      )
    }
    return classified
  }

  async function unstarMany(ids: number[], onProgress?: (done: number) => void) {
    if (!token.value) throw new Error('请先连接 GitHub')
    const targets = ids
      .map(id => repositoryMap.value.get(id))
      .filter((repository): repository is StarredRepository => Boolean(repository))

    const completedIds: number[] = []
    try {
      for (const repository of targets) {
        await unstarRepository(token.value, repository.fullName)
        await db.repositories.delete(repository.id)
        completedIds.push(repository.id)
        onProgress?.(completedIds.length)
      }
    } finally {
      const removedIds = new Set(completedIds)
      repositories.value = repositories.value.filter(repository => !removedIds.has(repository.id))
    }
  }

  function exportBackup(): BackupData {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      repositories: repositories.value,
      groups: groups.value
    }
  }

  async function importBackup(backup: BackupData) {
    if (backup.version !== 1 || !Array.isArray(backup.repositories) || !Array.isArray(backup.groups)) {
      throw new Error('无法识别的备份文件')
    }
    await db.transaction('rw', db.repositories, db.groups, async () => {
      await db.repositories.clear()
      await db.groups.clear()
      await db.repositories.bulkPut(backup.repositories)
      await db.groups.bulkPut(backup.groups)
    })
    repositories.value = backup.repositories
    groups.value = backup.groups.sort((a, b) => a.name.localeCompare(b.name))
  }

  return {
    repositories,
    groups,
    profile,
    token,
    lastSyncAt,
    loading,
    syncing,
    error,
    initialize,
    connect,
    disconnect,
    syncStars,
    createGroup,
    updateGroup,
    publishGroup,
    deleteGroup,
    assignGroup,
    removeGroup,
    addTags,
    autoClassify,
    unstarMany,
    exportBackup,
    importBackup
  }
})
