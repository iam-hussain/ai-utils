import { apiConfig } from './api'

const { baseUrl, defaultOptions } = apiConfig

export const DEFAULT_ENVIRONMENTS = ['DEV', 'SIT', 'UAT', 'PT', 'PROD']

export interface Project {
  id: string
  name: string
  teamIds: string[]
  ownerId: string
  description?: string
  environments?: string[]
  createdAt: string
  updatedAt: string
}

export async function fetchProjects(teamId?: string): Promise<Project[]> {
  const url = teamId
    ? `${baseUrl}/api/projects?teamId=${encodeURIComponent(teamId)}`
    : `${baseUrl}/api/projects`
  const res = await fetch(url, defaultOptions)
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) throw new Error('Failed to fetch projects')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`${baseUrl}/api/projects/${id}`, defaultOptions)
  if (res.status === 404) throw new Error('Project not found')
  if (!res.ok) throw new Error('Failed to fetch project')
  const data = await res.json()
  return { ...data, id: data.id ?? data._id ?? id }
}

export async function createProject(
  name: string,
  teamIds: string[] = [],
  description?: string
): Promise<Project> {
  const res = await fetch(`${baseUrl}/api/projects`, {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify({ name, teamIds, description }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to create project')
  }
  return res.json()
}

export async function updateProject(
  id: string,
  data: { name?: string; description?: string; environments?: string[] }
): Promise<Project> {
  const res = await fetch(`${baseUrl}/api/projects/${id}`, {
    ...defaultOptions,
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to update project')
  }
  return res.json()
}

export async function addTeamToProject(projectId: string, teamId: string): Promise<Project> {
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/teams`, {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify({ teamId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to add team')
  }
  return res.json()
}

export async function removeTeamFromProject(
  projectId: string,
  teamId: string
): Promise<Project> {
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/teams/${teamId}`, {
    ...defaultOptions,
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to remove team')
  }
  return res.json()
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/projects/${id}`, {
    ...defaultOptions,
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to delete project')
  }
}
