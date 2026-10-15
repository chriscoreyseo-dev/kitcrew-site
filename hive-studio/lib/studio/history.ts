import type { RunDTO } from "@/lib/generations/model"

/** One generation as the studio shows it. Served by the database now
    (lib/generations); the name is kept so the template's components don't change. */
export type RunRecord = RunDTO
export type RunStatus = RunDTO["status"]
