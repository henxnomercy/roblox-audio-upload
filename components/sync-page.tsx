"use client"

import type React from "react"
import { useState } from "react"
import { Eye, EyeOff, KeyRound, Loader2, Music4, ShieldCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Credentials } from "@/app/page"

type SyncPageProps = {
  onSynced: (credentials: Credentials) => void
}

export function SyncPage({ onSynced }: SyncPageProps) {
  const [groupId, setGroupId] = useState("")
  const [userId, setUserId] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!groupId.trim() || !userId.trim() || !apiKey.trim()) {
      setError("All fields are required to sync your account.")
      return
    }

    setIsSyncing(true)
    // Mock the sync/auth request
    setTimeout(() => {
      setIsSyncing(false)
      onSynced({ groupId: groupId.trim(), userId: userId.trim(), apiKey: apiKey.trim() })
    }, 1500)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Music4 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">Roblox Audio Studio</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            Sync your account to convert and upload audio assets through the Open Cloud API.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/20 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Sync Account</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enter your credentials to link this dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="groupId" className="text-sm font-medium">
                Group ID
              </label>
              <div className="relative">
                <Users
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="groupId"
                  inputMode="numeric"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  placeholder="e.g. 1234567"
                  className="w-full rounded-lg border border-input bg-background/50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="userId" className="text-sm font-medium">
                User ID
              </label>
              <div className="relative">
                <ShieldCheck
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="userId"
                  inputMode="numeric"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="e.g. 987654321"
                  className="w-full rounded-lg border border-input bg-background/50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="apiKey" className="text-sm font-medium">
                Open Cloud API Key
              </label>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your secret API key"
                  autoComplete="off"
                  className="w-full rounded-lg border border-input bg-background/50 py-2.5 pl-9 pr-10 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={isSyncing} className="mt-1 h-11 w-full text-sm font-semibold">
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Syncing account...
                </>
              ) : (
                "Sync Account"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Your API key is only stored in memory for this session and never leaves your browser in this demo.
          Made by HXTeam. Based in Bandung.
        </p>
      </div>
    </div>
  )
}
