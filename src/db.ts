import Dexie, { type EntityTable } from 'dexie'

import type { AppSetting, Repository, StarGroup } from './types'

class StarloomDatabase extends Dexie {
  repositories!: EntityTable<Repository, 'id'>
  groups!: EntityTable<StarGroup, 'id'>
  settings!: EntityTable<AppSetting, 'key'>

  constructor() {
    super('starloom')
    this.version(1).stores({
      repositories:
        'id, fullName, language, status, archived, starredAt, pushedAt, *groupIds, *tags',
      groups: 'id, &name, createdAt',
      settings: 'key'
    })
    this.version(2)
      .stores({
        repositories:
          'id, &nodeId, fullName, language, status, archived, isStarred, ownership, visibility, starredAt, pushedAt, *groupIds, *tags',
        groups: 'id, &name, createdAt',
        settings: 'key'
      })
      .upgrade(transaction =>
        transaction.table('repositories').toCollection().modify(repository => {
          repository.provider = 'github'
          repository.providerRepoId = String(repository.id)
          repository.isStarred = true
          repository.ownership = 'external'
          repository.visibility = 'public'
          repository.permissions = { admin: false, push: false, pull: true }
        })
      )
  }
}

export const db = new StarloomDatabase()
