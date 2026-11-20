"use client"

import { Button } from "@/components/ui/button"
import {
  adminDismissReportsAction,
  adminUnpublishGenerationAction,
} from "@/generation/admin-actions"

import { ErrorText } from "./ui"
import { useAdminAction } from "./use-admin-action"

export function ReportActions({ generationId }: { generationId: string }) {
  const { pending, error, execute } = useAdminAction()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => execute(() => adminDismissReportsAction(generationId))}
        >
          Dismiss
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() =>
            execute(() => adminUnpublishGenerationAction(generationId))
          }
        >
          Unpublish
        </Button>
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  )
}
