import { Octokit } from '@octokit/rest'

import type { GitHubProfile, StarredRepository } from '../types'

interface GitHubStarredItem {
  starred_at: string
  repo: {
    id: number
    name: string
    full_name: string
    description: string | null
    html_url: string
    language: string | null
    topics?: string[]
    stargazers_count: number
    forks_count: number
    archived: boolean
    fork: boolean
    pushed_at: string | null
    owner: { login: string } | null
  }
}

const createClient = (token: string) => new Octokit({ auth: token })

export async function fetchProfile(token: string): Promise<GitHubProfile> {
  const { data } = await createClient(token).rest.users.getAuthenticated()
  return {
    login: data.login,
    avatarUrl: data.avatar_url
  }
}

export async function fetchAllStars(token: string): Promise<StarredRepository[]> {
  const client = createClient(token)
  const response = await client.paginate(client.rest.activity.listReposStarredByAuthenticatedUser, {
    per_page: 100,
    headers: {
      accept: 'application/vnd.github.star+json'
    }
  })
  const now = new Date().toISOString()

  return (response as unknown as GitHubStarredItem[]).map(({ repo, starred_at }) => ({
    id: repo.id,
    name: repo.name,
    owner: repo.owner?.login ?? '',
    fullName: repo.full_name,
    description: repo.description ?? '',
    htmlUrl: repo.html_url,
    language: repo.language ?? 'Other',
    topics: repo.topics ?? [],
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    archived: repo.archived,
    fork: repo.fork,
    starredAt: starred_at,
    pushedAt: repo.pushed_at ?? '',
    syncedAt: now,
    status: 'inbox',
    groupIds: [],
    tags: []
  }))
}

export async function unstarRepository(token: string, fullName: string): Promise<void> {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo) throw new Error(`无效仓库名称：${fullName}`)

  await createClient(token).rest.activity.unstarRepoForAuthenticatedUser({ owner, repo })
}
