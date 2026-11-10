import type { DefaultSession } from "next-auth"

export type Role = "user" | "admin"

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"]
  }
  interface User {
    role?: Role
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role?: Role
  }
}
