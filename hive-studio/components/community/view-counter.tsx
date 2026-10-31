"use client"

import { useEffect } from "react"

import { countViewAction } from "@/generation/community-actions"

/** Counts one view of the post when its page /g/<id> opens (D-079). */
export function ViewCounter({ id }: { id: string }) {
  useEffect(() => {
    void countViewAction(id)
  }, [id])
  return null
}
