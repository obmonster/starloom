import { Octokit } from '@octokit/rest'

import type {
  GitHubList,
  GitHubProfile,
  Repository,
  RepositoryPermissions,
  RepositoryVisibility
} from '../types'

interface GitHubStarredItem {
  starred_at: string
  repo: {
    id: number
    node_id: string
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
    owner: { login: string; type?: string } | null
  }
}

type GitHubRepositoryItem = GitHubStarredItem['repo'] & {
  visibility?: string
  private?: boolean
  permissions?: Partial<RepositoryPermissions>
}

const createClient = (token: string) => new Octokit({ auth: token })

interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

interface GitHubListNode {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  createdAt: string
  updatedAt: string
  items: {
    nodes: Array<{ id: string } | null>
    pageInfo: PageInfo
  }
}

type GitHubListMetadata = Omit<GitHubList, 'description' | 'repositoryNodeIds'> & {
  description: string | null
}

const LIST_FIELDS = `
  id
  name
  description
  isPrivate
  createdAt
  updatedAt
`

const LISTS_QUERY = `
  query StarloomLists($cursor: String) {
    viewer {
      lists(first: 100, after: $cursor) {
        nodes {
          ${LIST_FIELDS}
          items(first: 100) {
            nodes { ... on Repository { id } }
            pageInfo { hasNextPage endCursor }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

const LIST_ITEMS_QUERY = `
  query StarloomListItems($listId: ID!, $cursor: String) {
    node(id: $listId) {
      ... on UserList {
        items(first: 100, after: $cursor) {
          nodes { ... on Repository { id } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`

export async function fetchProfile(token: string): Promise<GitHubProfile> {
  const { data } = await createClient(token).rest.users.getAuthenticated()
  return {
    login: data.login,
    avatarUrl: data.avatar_url
  }
}

const mapRepository = (
  repo: GitHubRepositoryItem,
  syncedAt: string,
  options: {
    isStarred: boolean
    starredAt?: string
    ownership?: Repository['ownership']
  }
): Repository => ({
  id: repo.id,
  provider: 'github',
  providerRepoId: String(repo.id),
  nodeId: repo.node_id,
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
  isStarred: options.isStarred,
  ownership: options.ownership ?? 'external',
  visibility: (repo.visibility ?? (repo.private ? 'private' : 'public')) as RepositoryVisibility,
  permissions: {
    admin: repo.permissions?.admin ?? options.ownership === 'owned',
    push: repo.permissions?.push ?? options.ownership === 'owned',
    pull: repo.permissions?.pull ?? true
  },
  starredAt: options.starredAt ?? '',
  pushedAt: repo.pushed_at ?? '',
  syncedAt,
  status: 'inbox',
  groupIds: [],
  tags: []
})

export async function fetchAllStars(token: string): Promise<Repository[]> {
  const client = createClient(token)
  const response = await client.paginate(client.rest.activity.listReposStarredByAuthenticatedUser, {
    per_page: 100,
    headers: {
      accept: 'application/vnd.github.star+json'
    }
  })
  const now = new Date().toISOString()

  return (response as unknown as GitHubStarredItem[]).map(({ repo, starred_at }) =>
    mapRepository(repo, now, { isStarred: true, starredAt: starred_at })
  )
}

export async function fetchManagedRepositories(
  token: string,
  viewerLogin: string
): Promise<Repository[]> {
  const client = createClient(token)
  const response = await client.paginate(client.rest.repos.listForAuthenticatedUser, {
    affiliation: 'owner,organization_member,collaborator',
    visibility: 'all',
    sort: 'pushed',
    per_page: 100
  })
  const now = new Date().toISOString()
  return (response as unknown as GitHubRepositoryItem[]).map(repository => {
    const ownership: Repository['ownership'] = repository.owner?.login.toLowerCase() === viewerLogin.toLowerCase()
      ? 'owned'
      : repository.owner?.type === 'Organization'
        ? 'organization'
        : 'collaborated'
    return mapRepository(repository, now, { isStarred: false, ownership })
  })
}

async function fetchRemainingListItems(
  client: Octokit,
  listId: string,
  initialItems: GitHubListNode['items']
): Promise<string[]> {
  const repositoryNodeIds = initialItems.nodes.flatMap(item => (item ? [item.id] : []))
  let pageInfo = initialItems.pageInfo

  while (pageInfo.hasNextPage) {
    const response = await client.graphql<{
      node: { items: GitHubListNode['items'] } | null
    }>(LIST_ITEMS_QUERY, { listId, cursor: pageInfo.endCursor })
    if (!response.node) break
    repositoryNodeIds.push(...response.node.items.nodes.flatMap(item => (item ? [item.id] : [])))
    pageInfo = response.node.items.pageInfo
  }
  return repositoryNodeIds
}

export async function fetchGitHubLists(token: string): Promise<GitHubList[]> {
  const client = createClient(token)
  const nodes: GitHubListNode[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const response: {
      viewer: { lists: { nodes: Array<GitHubListNode | null>; pageInfo: PageInfo } }
    } = await client.graphql(LISTS_QUERY, { cursor })
    nodes.push(...response.viewer.lists.nodes.filter((node): node is GitHubListNode => Boolean(node)))
    hasNextPage = response.viewer.lists.pageInfo.hasNextPage
    cursor = response.viewer.lists.pageInfo.endCursor
  }

  return Promise.all(
    nodes.map(async node => ({
      id: node.id,
      name: node.name,
      description: node.description ?? '',
      isPrivate: node.isPrivate,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      repositoryNodeIds: await fetchRemainingListItems(client, node.id, node.items)
    }))
  )
}

export async function createGitHubList(
  token: string,
  name: string,
  description: string,
  isPrivate: boolean
): Promise<GitHubList> {
  const response = await createClient(token).graphql<{
    createUserList: { list: GitHubListMetadata | null }
  }>(
    `mutation StarloomCreateList($input: CreateUserListInput!) {
      createUserList(input: $input) { list { ${LIST_FIELDS} } }
    }`,
    { input: { name, description, isPrivate } }
  )
  if (!response.createUserList.list) throw new Error('GitHub 未返回新建的 List')
  return {
    ...response.createUserList.list,
    description: response.createUserList.list.description ?? '',
    repositoryNodeIds: []
  }
}

export async function updateGitHubList(
  token: string,
  listId: string,
  name: string,
  description: string,
  isPrivate: boolean
): Promise<GitHubList> {
  const response = await createClient(token).graphql<{
    updateUserList: { list: GitHubListMetadata | null }
  }>(
    `mutation StarloomUpdateList($input: UpdateUserListInput!) {
      updateUserList(input: $input) { list { ${LIST_FIELDS} } }
    }`,
    { input: { listId, name, description, isPrivate } }
  )
  if (!response.updateUserList.list) throw new Error('GitHub 未返回更新后的 List')
  return {
    ...response.updateUserList.list,
    description: response.updateUserList.list.description ?? '',
    repositoryNodeIds: []
  }
}

export async function deleteGitHubList(token: string, listId: string): Promise<void> {
  await createClient(token).graphql(
    `mutation StarloomDeleteList($input: DeleteUserListInput!) {
      deleteUserList(input: $input) { clientMutationId }
    }`,
    { input: { listId } }
  )
}

export async function updateGitHubListsForRepository(
  token: string,
  repositoryNodeId: string,
  listIds: string[]
): Promise<void> {
  await createClient(token).graphql(
    `mutation StarloomUpdateListsForItem($input: UpdateUserListsForItemInput!) {
      updateUserListsForItem(input: $input) { item { ... on Repository { id } } }
    }`,
    { input: { itemId: repositoryNodeId, listIds } }
  )
}

export async function unstarRepository(token: string, fullName: string): Promise<void> {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo) throw new Error(`无效仓库名称：${fullName}`)

  await createClient(token).rest.activity.unstarRepoForAuthenticatedUser({ owner, repo })
}
