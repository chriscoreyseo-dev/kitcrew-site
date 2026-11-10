import type { Metadata } from "next"

import { GeneratorPage } from "@/app/generator-page"

export const metadata: Metadata = { title: "Video · Hive Studio" }

export default function VideoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return <GeneratorPage surface="video" searchParams={searchParams} />
}
