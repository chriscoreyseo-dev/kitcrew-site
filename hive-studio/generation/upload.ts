import { parseUploadTicket, requireUploadContentType } from "./upload-contract"

/** Browser half of an upload: ask our server for a signed URL (it records the
    public URL), then PUT the file straight to storage without cookies. */
export async function uploadMedia(file: File): Promise<{ uploadId: string }> {
  const contentType = requireUploadContentType(file.type)
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, size: file.size }),
  })
  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new Error(
      `Could not prepare reference upload (${res.status}). Try again.`
    )
  }
  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error
        : null
    throw new Error(
      typeof message === "string"
        ? message
        : `Could not prepare reference upload (${res.status}). Try again.`
    )
  }
  const ticket = parseUploadTicket(payload, contentType)
  const uploadId =
    payload && typeof payload === "object" && "uploadId" in payload
      ? payload.uploadId
      : null
  if (typeof uploadId !== "string")
    throw new Error("Could not prepare reference upload. Try again.")
  // The storage request must not carry our cookies.
  const uploaded = await fetch(ticket.upload_url, {
    method: "PUT",
    headers: ticket.upload_headers,
    body: file,
    credentials: "omit",
  })
  if (!uploaded.ok)
    throw new Error(
      `Reference upload failed (${uploaded.status}). Try uploading the file again.`
    )
  return { uploadId }
}
