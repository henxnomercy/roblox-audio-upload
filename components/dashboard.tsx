"use client"

import React, { useEffect, useState } from "react"
import { Music4, Shirt, Settings } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"

import { Dashboard as AudioStudio } from "./audio-studio"
import { ThreadsStudio } from "./threads-studio"

type Props = {
	discordUser: string
	onDisconnect?: () => void
}

export function Dashboard({ discordUser, onDisconnect }: Props) {
	const [activeMenu, setActiveMenu] = useState<string>("audio")
	const [showContent, setShowContent] = useState<boolean>(true)
	const [groupId, setGroupId] = useState<string>("")
	const [apiKey, setApiKey] = useState<string>("")
	const [isConfigured, setIsConfigured] = useState<boolean>(false)
	const [setupError, setSetupError] = useState<string | null>(null)
	const [settingsSaved, setSettingsSaved] = useState<boolean>(false)

	useEffect(() => {
		const storedGroupId = localStorage.getItem("hx_group_id") ?? ""
		const storedApiKey = localStorage.getItem("hx_api_key") ?? ""
		setGroupId(storedGroupId)
		setApiKey(storedApiKey)
		setIsConfigured(Boolean(storedGroupId && storedApiKey))
	}, [])

	useEffect(() => {
		// small fade-out then fade-in when activeMenu changes
		setShowContent(false)
		const t = setTimeout(() => setShowContent(true), 80)
		return () => clearTimeout(t)
	}, [activeMenu])

	const saveConfiguration = () => {
		setSetupError(null)
		if (!groupId.trim() || !apiKey.trim()) {
			setSetupError("Both Group ID and API Key are required.")
			return
		}

		localStorage.setItem("hx_group_id", groupId.trim())
		localStorage.setItem("hx_api_key", apiKey.trim())
		setIsConfigured(true)
		setSettingsSaved(true)
		window.setTimeout(() => setSettingsSaved(false), 2000)
	}

	const saveSettings = () => {
		setSetupError(null)
		if (!groupId.trim() || !apiKey.trim()) {
			setSetupError("Both Group ID and API Key are required.")
			return
		}

		localStorage.setItem("hx_group_id", groupId.trim())
		localStorage.setItem("hx_api_key", apiKey.trim())
		setIsConfigured(true)
		setSettingsSaved(true)
		window.setTimeout(() => setSettingsSaved(false), 2000)
	}

	const storedCredentials = {
		groupId,
		userId: discordUser,
		apiKey,
	}

	const showSetup = !isConfigured && activeMenu !== "settings"

	return (
		<div className="min-h-screen bg-background text-foreground">
			<div className="flex">
				{/* Sidebar */}
				<aside className="hidden sm:flex sm:flex-col fixed inset-y-0 left-0 w-64 bg-background border-r border-border p-4">
					<div className="flex items-center gap-2 px-2 py-3">
						<div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">HX</div>
						<h1 className="text-lg font-semibold">HXSync</h1>
					</div>

					<nav className="mt-6 flex flex-col gap-2 px-2">
						<Button
							variant={activeMenu === "audio" ? "secondary" : "ghost"}
							size="default"
							className="justify-start w-full"
							onClick={() => setActiveMenu("audio")}
							data-icon="inline-start"
						>
							<Music4 className={cn("mr-2")} />
							Audio Studio
						</Button>

						<Button
							variant={activeMenu === "threads" ? "secondary" : "ghost"}
							size="default"
							className="justify-start w-full"
							onClick={() => setActiveMenu("threads")}
							data-icon="inline-start"
						>
							<Shirt className={cn("mr-2")} />
							Threads Studio
						</Button>

						<Button
							variant={activeMenu === "settings" ? "secondary" : "ghost"}
							size="default"
							className="justify-start w-full mt-2"
							onClick={() => setActiveMenu("settings")}
							data-icon="inline-start"
						>
							<Settings className={cn("mr-2")} />
							Settings
						</Button>
					</nav>

					<div className="mt-auto px-2 py-4 text-sm text-muted-foreground">
						<button
							className="text-xs text-destructive hover:underline"
							onClick={onDisconnect}
						>
							Disconnect
						</button>
					</div>
				</aside>

				{/* Main content area */}
				<main className="flex-1 min-h-screen w-full sm:ml-64">
					<div className="max-w-7xl mx-auto p-4">
						<div
							className={cn(
								"transition-opacity duration-300 ease-in-out",
								showContent ? "opacity-100" : "opacity-0"
							)}
						>
							{showSetup ? (
								<div className="rounded-3xl border border-border bg-card p-6 shadow-lg shadow-black/20 sm:p-8">
									<div className="mb-6 space-y-3">
										<h2 className="text-2xl font-semibold">Roblox Configuration Setup</h2>
										<p className="text-sm text-muted-foreground">
											Sign in with Discord first, then enter your Roblox Group ID and API Key to unlock Audio and Threads Studio.
										</p>
									</div>
									<div className="grid gap-4">
										<div className="grid gap-2">
											<label htmlFor="setupGroupId" className="text-sm font-medium">
												Group ID
											</label>
											<input
												id="setupGroupId"
												value={groupId}
												onChange={(e) => setGroupId(e.target.value)}
												placeholder="Enter your Roblox Group ID"
												className="h-11 rounded-3xl border border-border bg-background/80 px-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
											/>
										</div>
										<div className="grid gap-2">
											<label htmlFor="setupApiKey" className="text-sm font-medium">
												API Key
											</label>
											<input
												id="setupApiKey"
												type="password"
												value={apiKey}
												onChange={(e) => setApiKey(e.target.value)}
												placeholder="Enter your Roblox API Key"
												className="h-11 rounded-3xl border border-border bg-background/80 px-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
											/>
										</div>
										{setupError ? (
											<p className="rounded-3xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
												{setupError}
											</p>
										) : null}
										<Button className="h-12 rounded-3xl px-5 text-sm font-semibold" onClick={saveConfiguration}>
											Save Configuration
										</Button>
									</div>
								</div>
							) : activeMenu === "audio" ? (
								<AudioStudio credentials={storedCredentials} onDisconnect={onDisconnect ?? (() => {})} />
							) : activeMenu === "threads" ? (
								<ThreadsStudio credentials={storedCredentials} onDisconnect={onDisconnect} />
							) : (
								<div className="rounded-3xl border border-border bg-card p-6 shadow-lg shadow-black/20 sm:p-8">
									<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<h2 className="text-2xl font-semibold">Settings</h2>
											<p className="mt-1 text-sm text-muted-foreground">
												Update your Roblox API credentials anytime without signing out.
											</p>
										</div>
										{settingsSaved ? (
											<span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-400">
												Saved
											</span>
										) : null}
									</div>
									<div className="grid gap-4">
										<div className="grid gap-2">
											<label htmlFor="settingsGroupId" className="text-sm font-medium">
												Group ID
											</label>
											<input
												id="settingsGroupId"
												value={groupId}
												onChange={(e) => setGroupId(e.target.value)}
												className="h-11 rounded-3xl border border-border bg-background/80 px-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
											/>
										</div>
										<div className="grid gap-2">
											<label htmlFor="settingsApiKey" className="text-sm font-medium">
												API Key
											</label>
											<input
												id="settingsApiKey"
												type="password"
												value={apiKey}
												onChange={(e) => setApiKey(e.target.value)}
												className="h-11 rounded-3xl border border-border bg-background/80 px-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
											/>
										</div>
										{setupError ? (
											<p className="rounded-3xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
												{setupError}
											</p>
										) : null}
										<Button className="h-12 rounded-3xl px-5 text-sm font-semibold" onClick={saveSettings}>
											Update API Credentials
										</Button>
									</div>
								</div>
							)}
						</div>
					</div>
				</main>
			</div>
		</div>
	)
}
