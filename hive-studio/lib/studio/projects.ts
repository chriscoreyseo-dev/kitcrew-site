import { create } from "zustand"

import {
  createProjectAction,
  deleteProjectAction,
  renameProjectAction,
} from "@/generation/library-actions"

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

type ProjectsState = {
  projects: Project[]
  error: string | null
  hydrate: (projects: Project[]) => void
  create: (name: string) => Project
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  touch: (id: string) => void
}

/** Projects live in MongoDB. Mutations apply optimistically (the id is a
    client UUID, so `create` can return synchronously) and roll back on error. */
export const useProjects = create<ProjectsState>()((set, get) => {
  const rollback = (previous: Project[], message: string) =>
    set({ projects: previous, error: message })

  return {
    projects: [],
    error: null,
    hydrate: (projects) => set({ projects, error: null }),
    create: (name) => {
      const now = Date.now()
      const project: Project = {
        id: crypto.randomUUID(),
        name: name.trim().slice(0, 80) || "Untitled",
        createdAt: now,
        updatedAt: now,
      }
      const previous = get().projects
      set({ projects: [project, ...previous] })
      void createProjectAction(project.id, project.name).then((r) => {
        if (!r.ok) rollback(previous, r.message)
      })
      return project
    },
    rename: (id, name) => {
      const previous = get().projects
      const trimmed = name.trim().slice(0, 80)
      if (!trimmed) return
      set({
        projects: previous.map((p) =>
          p.id === id ? { ...p, name: trimmed, updatedAt: Date.now() } : p
        ),
      })
      void renameProjectAction(id, trimmed).then((r) => {
        if (!r.ok) rollback(previous, r.message)
      })
    },
    remove: (id) => {
      const previous = get().projects
      set({ projects: previous.filter((p) => p.id !== id) })
      void deleteProjectAction(id).then((r) => {
        if (!r.ok) rollback(previous, r.message)
      })
    },
    // The server bumps updatedAt on submit; this only reorders locally.
    touch: (id) =>
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, updatedAt: Date.now() } : p
        ),
      })),
  }
})
