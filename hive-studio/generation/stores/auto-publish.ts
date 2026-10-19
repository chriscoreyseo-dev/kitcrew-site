import { create } from "zustand"
import { persist } from "zustand/middleware"

import { browserStorage } from "./browser-storage"

/** The generator's Auto-publish switch (D-065). Off until the member turns it
    on; remembered per browser, so a cleared store falls back to off.
    `skipHydration`: the server renders "off", and the switch rehydrates after
    mount, so the first client render matches the server's. */
type AutoPublishState = {
  on: boolean
  set: (on: boolean) => void
}

export const useAutoPublish = create<AutoPublishState>()(
  persist(
    (set) => ({
      on: false,
      set: (on) => set({ on }),
    }),
    {
      name: "hive.auto-publish.v1",
      storage: browserStorage(),
      partialize: (state) => ({ on: state.on }),
      skipHydration: true,
    }
  )
)
