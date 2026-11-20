import { BRAND } from "@/lib/brand"

/** Shown instead of a studio screen when no model files are installed.
    Developers: add a model file under generation/catalog/models/ (see
    docs/model-catalog.md); the dev server picks it up. */
export function NoModels() {
  return (
    <main className="flex min-h-[calc(100dvh-var(--header-h))] items-center justify-center p-6 text-center">
      <div className="flex max-w-xl flex-col items-center gap-3">
        <h1 className="font-heading text-3xl font-bold uppercase">
          Back in a moment
        </h1>
        <p className="text-sm text-muted-foreground">
          {BRAND.name} is updating its models. Please try again shortly, or
          write to{" "}
          <a
            className="text-foreground underline"
            href={`mailto:${BRAND.supportEmail}`}
          >
            {BRAND.supportEmail}
          </a>
          .
        </p>
      </div>
    </main>
  )
}
