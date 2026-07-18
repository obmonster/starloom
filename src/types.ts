export type RepositoryStatus = 'inbox' | 'organized' | 'watching'
export type RepositoryOwnership = 'owned' | 'organization' | 'collaborated' | 'external'
export type RepositoryVisibility = 'public' | 'private' | 'internal'

export interface RepositoryPermissions {
  admin: boolean
  push: boolean
  pull: boolean
}

export interface Repository {
  id: number
  provider: 'github'
  providerRepoId: string
  nodeId: string
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
  isStarred: boolean
  ownership: RepositoryOwnership
  visibility: RepositoryVisibility
  permissions: RepositoryPermissions
  starredAt: string
  pushedAt: string
  syncedAt: string
  status: RepositoryStatus
  groupIds: string[]
  tags: string[]
}

export interface StarGroup {
  id: string
  githubId?: string
  name: string
  description?: string
  isPrivate?: boolean
  color: string
  createdAt: string
  updatedAt?: string
}

export interface GitHubList {
  id: string
  name: string
  description: string
  isPrivate: boolean
  createdAt: string
  updatedAt: string
  repositoryNodeIds: string[]
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
  version: 1 | 2
  exportedAt: string
  repositories: Repository[]
  groups: StarGroup[]
}

export type RepositoryModule = 'owned' | 'starred'

export type RepositoryView =
  | 'managed'
  | 'stars'
  | 'owned'
  | 'organization'
  | 'collaborated'
  | 'public'
  | 'non-public'
  | 'forks'
  | 'owned-archived'
  | 'inbox'
  | 'archived'
  | 'stale'
  | string
