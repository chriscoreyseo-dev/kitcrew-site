import type { Metadata } from "next"

import { GeneratorPage } from "@/app/generator-page"

export const metadata: Metadata = { title: "Audio · Hive Studio" }

export default function AudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return <GeneratorPage surface="audio" searchParams={searchParams} />
}
