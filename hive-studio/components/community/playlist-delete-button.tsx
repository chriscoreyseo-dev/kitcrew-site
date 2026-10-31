"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"

import { deletePlaylistAction } from "@/generation/media-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** Deletes one of the viewer's playlists (the posts stay published). */
export function PlaylistDeleteButton({
  id,
  name,
}: {
  id: string
  name: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function remove() {
    setError(null)
    startTransition(async () => {
      const result = await deletePlaylistAction(id)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete playlist ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              The playlist goes; the posts in it stay in the Media Feed.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="px-6 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={remove}
            >
              {pending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
