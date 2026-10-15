import { MODELS } from "@/generation/catalog"
import { currentUser } from "@/lib/session"
import { StudioTemplate } from "@/layouts/studio"

import { NoModels } from "@/components/studio/no-models"

export default async function Page() {
  if (MODELS.length === 0) return <NoModels />
  const user = await currentUser()
  return (
    <StudioTemplate
      title="Hive Studio"
      user={user ? { email: user.email } : null}
    />
  )
}
