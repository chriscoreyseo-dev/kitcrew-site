import type { Metadata } from "next"

import { GeneratorPage } from "@/app/generator-page"

export const metadata: Metadata = { title: "Image · Hive Studio" }

export default function ImagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return <GeneratorPage surface="image" searchParams={searchParams} />
}
