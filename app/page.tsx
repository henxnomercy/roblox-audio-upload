"use client"

import { useEffect, useState } from "react"
import { Music4 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dashboard } from "@/components/dashboard"

export type Credentials = {
  groupId: string
  userId: string
  apiKey: string
}

export default function Page() {
  const [discordUser, setDiscordUser] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const savedDiscordUser = localStorage.getItem("hx_discord_user")
    if (savedDiscordUser) {
      setDiscordUser(savedDiscordUser)
    }
    setInitialized(true)
  }, [])

  if (!initialized) return null

  return (
    <main className="min-h-dvh w-full bg-background text-foreground">
      {discordUser ? (
        <Dashboard
          discordUser={discordUser}
          onDisconnect={() => {
            localStorage.removeItem("hx_discord_user")
            setDiscordUser(null)
          }}
        />
      ) : (
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-card/70 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-8 space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-sm shadow-primary/10">
                <Music4 className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-semibold">Sign in with Discord</h1>
              <p className="text-sm text-muted-foreground">
                Authenticate with Discord to access HXSync and configure your Roblox API credentials.
              </p>
            </div>
            <div className="space-y-4">
              <Button
                className="w-full rounded-3xl px-5 py-3 text-sm font-semibold"
                onClick={() => {
                  const simulatedUser = "discord_user_123"
                  localStorage.setItem("hx_discord_user", simulatedUser)
                  setDiscordUser(simulatedUser)
                }}
              >
                Continue with Discord
              </Button>
              <div className="rounded-3xl border border-border bg-background/80 p-4 text-sm text-muted-foreground">
                This is a Discord-first flow. You can update your Roblox Group ID and API key after sign-in in the Settings tab.
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
