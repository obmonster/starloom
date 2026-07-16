import Dexie, { type EntityTable } from 'dexie'

import type { AppSetting, StarGroup, StarredRepository } from './types'

class StarloomDatabase extends Dexie {
  repositories!: EntityTable<StarredRepository, 'id'>
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
  }
}

export const db = new StarloomDatabase()
