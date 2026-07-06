"use client"

import { useState } from "react"
import { SyncPage } from "@/components/sync-page"
import { Dashboard } from "@/components/dashboard"

export type Credentials = {
  groupId: string
  userId: string
  apiKey: string
}

export default function Page() {
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  return (
    <main className="min-h-dvh w-full">
      {credentials ? (
        <Dashboard credentials={credentials} onDisconnect={() => setCredentials(null)} />
      ) : (
        <SyncPage onSynced={setCredentials} />
      )}
    </main>
  )
}
