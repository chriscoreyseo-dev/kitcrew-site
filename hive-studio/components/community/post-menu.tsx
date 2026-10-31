"use client"

import { useEffect, useState, useTransition } from "react"
import type { FormEvent } from "react"
import {
  Bookmark,
  Clock,
  Flag,
  Forward,
  Loader2,
  MoreVertical,
  Plus,
} from "lucide-react"

import {
  createPlaylistAction,
  playlistItemAction,
  playlistsForAction,
  watchLaterAction,
} from "@/generation/media-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { PlaylistSummary } from "@/lib/saved-lists"

import { ReportDialog } from "./report-dialog"
import { ShareButtons, shareLink } from "./share-buttons"

/** A Media Feed post's three-dot menu (Chris, 2026-10-30, D-079), YouTube's
    without Download or Add to queue: Save to Watch Later, Save to playlist,
    Share - and on a picture, Share alone (nothing to watch later) - plus
    Report for anyone but the creator (a derogatory picture or video). The
    lists are on the Library menu (Watch Later, Playlists). */
export function PostMenu({
  postId,
  label,
  video,
  mine,
  watchLater,
  onWatchLater,
  onPlaylistChange,
}: {
  postId: string
  /** What the post is, for the share text and the dialogs. */
  label: string
  /** Watch Later and playlists are for videos; a picture's menu is Share only. */
  video: boolean
  /** The viewer made it: no Report. */
  mine: boolean
  watchLater: boolean
  onWatchLater: (saved: boolean) => void
  /** A playlist gained or lost this post (the playlist page drops it). */
  onPlaylistChange?: (playlistId: string, inList: boolean) => void
}) {
  const [dialog, setDialog] = useState<"playlist" | "share" | "report" | null>(
    null
  )
  const [status, setStatus] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleWatchLater() {
    const next = !watchLater
    setStatus(null)
    startTransition(async () => {
      const result = await watchLaterAction(postId, next)
      if (!result.ok) {
        setStatus(result.message)
        return
      }
      onWatchLater(result.data.saved)
      setStatus(
        result.data.saved ? "Saved to Watch Later" : "Removed from Watch Later"
      )
    })
  }

  return (
    <div className="relative ml-auto flex items-center gap-2">
      {status ? (
        <span role="status" className="text-xs text-muted-foreground">
          {status}
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More actions"
          className="flex size-8 items-center justify-center rounded-full text-[#2f4370] outline-none hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-ring"
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <MoreVertical className="size-5" aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="min-w-56">
          {video ? (
            <>
              <DropdownMenuItem onClick={toggleWatchLater}>
                <Clock aria-hidden />
                {watchLater ? "Remove from Watch Later" : "Save to Watch Later"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog("playlist")}>
                <Bookmark aria-hidden />
                Save to playlist
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem onClick={() => setDialog("share")}>
            <Forward aria-hidden />
            Share
          </DropdownMenuItem>
          {mine ? null : (
            <DropdownMenuItem onClick={() => setDialog("report")}>
              <Flag aria-hidden />
              Report
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Mounted only while open, so each opening starts fresh. */}
      {dialog === "playlist" ? (
        <PlaylistDialog
          postId={postId}
          onClose={() => setDialog(null)}
          onChange={onPlaylistChange}
        />
      ) : null}
      {dialog === "report" ? (
        <ReportDialog
          generationId={postId}
          open
          onOpenChange={(next) => !next && setDialog(null)}
        />
      ) : null}
      {dialog === "share" ? (
        <ShareDialog
          postId={postId}
          label={label}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}

function PlaylistDialog({
  postId,
  onClose,
  onChange,
}: {
  postId: string
  onClose: () => void
  onChange?: (playlistId: string, inList: boolean) => void
}) {
  const [lists, setLists] = useState<PlaylistSummary[] | null>(null)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let live = true
    void playlistsForAction(postId).then((result) => {
      if (!live) return
      if (result.ok) setLists(result.data)
      else {
        setLists([])
        setError(result.message)
      }
    })
    return () => {
      live = false
    }
  }, [postId])

  function toggle(list: PlaylistSummary) {
    const inList = !list.has
    setError(null)
    setLists(
      (prev) =>
        prev?.map((l) =>
          l.id === list.id
            ? { ...l, has: inList, count: l.count + (inList ? 1 : -1) }
            : l
        ) ?? null
    )
    startTransition(async () => {
      const result = await playlistItemAction(list.id, postId, inList)
      if (!result.ok) {
        setError(result.message)
        setLists(
          (prev) => prev?.map((l) => (l.id === list.id ? list : l)) ?? null
        )
        return
      }
      onChange?.(list.id, inList)
    })
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || pending) return
    setError(null)
    startTransition(async () => {
      const result = await createPlaylistAction(name, postId)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setLists((prev) => [result.data, ...(prev ?? [])])
      setName("")
      onChange?.(result.data.id, true)
    })
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Save to playlist</DialogTitle>
          <DialogDescription>
            Tick a playlist to keep this post in it. Your playlists are under
            Library.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            {lists === null ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading your playlists
              </p>
            ) : lists.length ? (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {lists.map((list) => (
                  <li key={list.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-ink/5 has-focus-visible:ring-2 has-focus-visible:ring-ring">
                      <input
                        type="checkbox"
                        checked={list.has}
                        onChange={() => toggle(list)}
                        className="size-4 accent-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {list.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {list.count}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No playlists yet.</p>
            )}
            <form onSubmit={create} className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="New playlist name"
                aria-label="New playlist name"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={!name.trim() || pending}
              >
                <Plus aria-hidden />
                Create
              </Button>
            </form>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShareDialog({
  postId,
  label,
  onClose,
}: {
  postId: string
  label: string
  onClose: () => void
}) {
  // The post's public page on this studio: anyone can open it, signed in or
  // not. Mounted only after a click, so window is there.
  const [link] = useState(() => shareLink(postId))

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>
            Anyone with the link can see this post.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <ShareButtons link={link} label={label} />
            <Input
              value={link}
              readOnly
              aria-label="Link to this post"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
