export type RepositoryStatus = 'inbox' | 'organized' | 'watching'

export interface StarredRepository {
  id: number
  name: string
  owner: string
  fullName: string
  description: string
  htmlUrl: string
  language: string
  topics: string[]
  stars: number
  forks: number
  archived: boolean
  fork: boolean
  starredAt: string
  pushedAt: string
  syncedAt: string
  status: RepositoryStatus
  groupIds: string[]
  tags: string[]
}

export interface StarGroup {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface AppSetting {
  key: string
  value: string
}

export interface GitHubProfile {
  login: string
  avatarUrl: string
}

export interface BackupData {
  version: 1
  exportedAt: string
  repositories: StarredRepository[]
  groups: StarGroup[]
}

export type RepositoryView = 'all' | 'inbox' | 'archived' | 'stale' | string
