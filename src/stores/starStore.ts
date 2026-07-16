import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { db } from '../db'
import { classificationRules, suggestGroups } from '../services/classifier'
import { fetchAllStars, fetchProfile, unstarRepository } from '../services/github'

import type { BackupData, GitHubProfile, StarGroup, StarredRepository } from '../types'

const TOKEN_KEY = 'starloom.github-token'
const PROFILE_KEY = 'starloom.github-profile'

const mergeRepository = (
  incoming: StarredRepository,
  existing?: StarredRepository
): StarredRepository => ({
  ...incoming,
  status: existing?.status ?? incoming.status,
  groupIds: existing?.groupIds ?? [],
  tags: existing?.tags ?? []
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
      const incoming = await fetchAllStars(token.value)
      const existing = new Map(repositories.value.map(repository => [repository.id, repository]))
      const merged = incoming.map(repository => mergeRepository(repository, existing.get(repository.id)))
      const incomingIds = new Set(merged.map(repository => repository.id))
      const removedIds = repositories.value
        .filter(repository => !incomingIds.has(repository.id))
        .map(repository => repository.id)

      await db.transaction('rw', db.repositories, db.settings, async () => {
        await db.repositories.bulkPut(merged)
        if (removedIds.length) await db.repositories.bulkDelete(removedIds)
        const now = new Date().toISOString()
        await db.settings.put({ key: 'lastSyncAt', value: now })
        lastSyncAt.value = now
      })
      repositories.value = merged
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '同步失败'
      throw cause
    } finally {
      syncing.value = false
    }
  }

  async function createGroup(name: string, color = '#6d5dfc'): Promise<StarGroup> {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('分组名称不能为空')
    const existing = groups.value.find(
      group => group.name.toLowerCase() === normalizedName.toLowerCase()
    )
    if (existing) return existing

    const group: StarGroup = {
      id: crypto.randomUUID(),
      name: normalizedName,
      color,
      createdAt: new Date().toISOString()
    }
    await db.groups.put(group)
    groups.value = [...groups.value, group].sort((a, b) => a.name.localeCompare(b.name))
    return group
  }

  async function assignGroup(ids: number[], groupId: string) {
    const updates = ids
      .map(id => repositoryMap.value.get(id))
      .filter((repository): repository is StarredRepository => Boolean(repository))
      .map(repository => ({
        ...repository,
        status: 'organized' as const,
        groupIds: [...new Set([...repository.groupIds, groupId])]
      }))
    await db.repositories.bulkPut(updates)
    const updateMap = new Map(updates.map(repository => [repository.id, repository]))
    repositories.value = repositories.value.map(repository => updateMap.get(repository.id) ?? repository)
  }

  async function removeGroup(ids: number[], groupId: string) {
    const updates = ids
      .map(id => repositoryMap.value.get(id))
      .filter((repository): repository is StarredRepository => Boolean(repository))
      .map(repository => {
        const groupIds = repository.groupIds.filter(id => id !== groupId)
        return {
          ...repository,
          status: groupIds.length ? repository.status : ('inbox' as const),
          groupIds
        }
      })
    await db.repositories.bulkPut(updates)
    const updateMap = new Map(updates.map(repository => [repository.id, repository]))
    repositories.value = repositories.value.map(repository => updateMap.get(repository.id) ?? repository)
  }

  async function addTags(ids: number[], nextTags: string[]) {
    const cleanTags = nextTags.map(tag => tag.trim()).filter(Boolean)
    const updates = ids
      .map(id => repositoryMap.value.get(id))
      .filter((repository): repository is StarredRepository => Boolean(repository))
      .map(repository => ({
        ...repository,
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

    for (const rule of classificationRules) {
      if (!groupByName.has(rule.group)) {
        groupByName.set(rule.group, await createGroup(rule.group, rule.color))
      }
    }

    const updates = targetRepositories.map(repository => {
      const suggestions = suggestGroups(repository)
      const suggestedIds = suggestions
        .map(rule => groupByName.get(rule.group)?.id)
        .filter((id): id is string => Boolean(id))
      if (!suggestedIds.length) return repository

      return {
        ...repository,
        status: 'organized' as const,
        groupIds: [...new Set([...repository.groupIds, ...suggestedIds])]
      }
    })
    await db.repositories.bulkPut(updates)
    const updateMap = new Map(updates.map(repository => [repository.id, repository]))
    repositories.value = repositories.value.map(repository => updateMap.get(repository.id) ?? repository)
    return updates.filter(repository => repository.groupIds.length).length
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
    assignGroup,
    removeGroup,
    addTags,
    autoClassify,
    unstarMany,
    exportBackup,
    importBackup
  }
})
