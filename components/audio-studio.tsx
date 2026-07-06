"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FileAudio,
  Loader2,
  LogOut,
  Music4,
  Sparkles,
  Upload,
  UploadCloud,
  User,
  X,
  ListVideo
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Credentials } from "@/app/page"

type DashboardProps = {
  credentials: Credentials
  onDisconnect: () => void
}

type QueueStatus = "pending" | "converting" | "uploading" | "checking" | "success" | "failed"

type QueueItem = {
  id: string
  file: File
  title: string
  duration: number | null
  amplify: number
  speed: number
  preset: string
  status: QueueStatus
  assetId: string | null
  errorMessage: string | null
  objectUrl: string
  convertedObjectUrl: string | null
}

const ACCENT_SETTINGS = {
  amplify: { min: 0.5, max: 3, step: 0.1, default: 0.8, unit: "x" },
  speed: { min: 0.5, max: 2, step: 0.1, default: 1.4, unit: "x" },
}

const MAX_DURATION_SECONDS = 7 * 60
const MAX_RENDER_DURATION_SECONDS = MAX_DURATION_SECONDS - 1
const MAX_ROBLOX_BYTES = 50 * 1024 * 1024 // 50 MB

function formatDuration(seconds: number) {
  const totalSecs = Math.round(seconds)
  const minutes = Math.floor(totalSecs / 60)
  const secondsPart = totalSecs % 60
  return `${minutes}:${secondsPart.toString().padStart(2, "0")}`
}

function trimTrailingSilence(buffer: AudioBuffer, audioContext: AudioContext, threshold = 0.001) {
  const channels = buffer.numberOfChannels
  let lastNonSilentFrame = -1

  for (let frame = buffer.length - 1; frame >= 0; frame -= 1) {
    let hasSignal = false

    for (let channel = 0; channel < channels; channel += 1) {
      if (Math.abs(buffer.getChannelData(channel)[frame]) > threshold) {
        hasSignal = true
        break
      }
    }

    if (hasSignal) {
      lastNonSilentFrame = frame
      break
    }
  }

  if (lastNonSilentFrame < 0) {
    return audioContext.createBuffer(channels, 1, buffer.sampleRate)
  }

  const trimmedBuffer = audioContext.createBuffer(channels, lastNonSilentFrame + 1, buffer.sampleRate)

  for (let channel = 0; channel < channels; channel += 1) {
    const sourceData = buffer.getChannelData(channel)
    const targetData = trimmedBuffer.getChannelData(channel)
    targetData.set(sourceData.subarray(0, lastNonSilentFrame + 1))
  }

  return trimmedBuffer
}

function audioBufferToWav(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataSize = buffer.length * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < buffer.length; i += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      let sample = buffer.getChannelData(channel)[i]
      sample = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" })
}

function floatTo16BitPCM(float32Array: Float32Array) {
  const out = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i += 1) {
    let s = Math.max(-1, Math.min(1, float32Array[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

async function encodeAudioBufferToMp3(buffer: AudioBuffer, bitrate = 128) {
  try {
    // 1. Import dengan casting paksa ke 'any'
    const lamejs = require('lamejs');
    const Mp3Encoder = lamejs.Mp3Encoder;
    
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const mp3Encoder = new Mp3Encoder(channels, sampleRate, bitrate);
    
    const blockSize = 1152;
    const mp3Data: Uint8Array[] = [];

    const left = buffer.getChannelData(0);
    const right = channels > 1 ? buffer.getChannelData(1) : null;

    for (let i = 0; i < buffer.length; i += blockSize) {
      const leftChunk = left.subarray(i, i + blockSize);
      // PASTIKAN FUNGSI floatTo16BitPCM SUDAH ADA DI FILE INI
      const left16 = floatTo16BitPCM(leftChunk); 
      
      let mp3buf;
      if (right) {
        const rightChunk = right.subarray(i, i + blockSize);
        const right16 = floatTo16BitPCM(rightChunk);
        mp3buf = mp3Encoder.encodeBuffer(left16, right16);
      } else {
        mp3buf = mp3Encoder.encodeBuffer(left16);
      }
      
      if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }

    const end = mp3Encoder.flush();
    if (end.length > 0) mp3Data.push(end);

    return new Blob(mp3Data as any, { type: 'audio/mpeg' });
  } catch (e) {
    console.error("Encoding Error:", e); // Tambahkan log ini untuk debug
    return null;
  }
}

async function convertAudioFile(file: File, preset: string) {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new AudioContext()
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))

  // Determine playback modifiers
  let playbackRate = 1
  let gainValue = 1
  let filterFrequency = 22000

  switch (preset) {
    case "nightcore":
      playbackRate = 1.2
      gainValue = 1.06
      filterFrequency = 20000
      break
    case "slowed":
      playbackRate = 0.8
      gainValue = 0.95
      filterFrequency = 18000
      break
    case "vaporwave":
      playbackRate = 0.9
      gainValue = 0.92
      filterFrequency = 12000
      break
    case "down-a-whole-step":
      playbackRate = 0.89
      gainValue = 1
      filterFrequency = 22000
      break
    case "up-a-whole-step":
      playbackRate = 1.12
      gainValue = 1.02
      filterFrequency = 22000
      break
    case "chipmunk":
      playbackRate = 1.35
      gainValue = 1.05
      filterFrequency = 22000
      break
    case "deep-bass":
      playbackRate = 0.95
      gainValue = 1.08
      filterFrequency = 9000
      break
    default:
      playbackRate = 1
      gainValue = 1
      filterFrequency = 22000
  }

  // Calculate effective duration after playback rate
  const originalDurationSec = decoded.length / decoded.sampleRate
  const effectiveDurationSec = originalDurationSec / playbackRate

  // Choose a sampling rate that will keep the final PCM WAV under the Roblox limit.
  const channels = decoded.numberOfChannels
  const allowedSampleRates = [44100, 32000, 24000, 22050, 16000, 11025, 8000]
  const candidateRates = allowedSampleRates.filter((s) => s <= decoded.sampleRate)
  if (candidateRates.length === 0) candidateRates.push(decoded.sampleRate)

  let chosenSampleRate: number | null = null
  for (const sr of candidateRates) {
    const estimatedBytes = Math.ceil(effectiveDurationSec * sr * channels * 2)
    if (estimatedBytes <= MAX_ROBLOX_BYTES) {
      chosenSampleRate = sr
      break
    }
  }

  // If none fit, pick the smallest available sample rate to try to reduce size
  if (!chosenSampleRate) chosenSampleRate = candidateRates[candidateRates.length - 1] ?? decoded.sampleRate

  // Decide render length (clamp to max render seconds)
  const renderSeconds = Math.min(effectiveDurationSec, MAX_RENDER_DURATION_SECONDS)
  const renderLength = Math.max(1, Math.floor(renderSeconds * chosenSampleRate))

  const offlineContext = new OfflineAudioContext(decoded.numberOfChannels, renderLength, chosenSampleRate)
  const source = offlineContext.createBufferSource()
  source.buffer = decoded
  source.playbackRate.value = playbackRate

  const gainNode = offlineContext.createGain()
  gainNode.gain.value = gainValue

  const filterNode = offlineContext.createBiquadFilter()
  filterNode.type = "lowpass"
  filterNode.frequency.value = filterFrequency

  source.connect(filterNode)
  filterNode.connect(gainNode)
  gainNode.connect(offlineContext.destination)
  source.start(0)

  const rendered = await offlineContext.startRendering()
  const trimmedRendered = trimTrailingSilence(rendered, audioContext)

  // Try to encode to MP3 at a few bitrates to reduce upload size.
  const preferredBitrates = [128, 96, 64]
  for (const br of preferredBitrates) {
    try {
      // encodeAudioBufferToMp3 does a dynamic import of lamejs and returns a Blob or null
      // If encoding fails or lib isn't available, continue to WAV fallback.
      // eslint-disable-next-line no-await-in-loop
      const mp3Blob = await encodeAudioBufferToMp3(trimmedRendered, br)
      if (mp3Blob && mp3Blob.size > 0 && mp3Blob.size <= MAX_ROBLOX_BYTES) {
        const mp3Url = URL.createObjectURL(mp3Blob)
        await audioContext.close()
        return mp3Url
      }
    } catch (e) {
      // ignore and try next bitrate or fallback
    }
  }

  // Fallback to WAV if MP3 not available or still too large
  const blob = audioBufferToWav(trimmedRendered)
  const url = URL.createObjectURL(blob)

  await audioContext.close()
  return url
}

function getQueueStatusLabel(status: QueueStatus) {
  switch (status) {
    case "uploading":
      return "Uploading"
    case "checking":
      return "Moderation Checking"
    case "success":
      return "Accepted"
    case "failed":
      return "Failed / Restricted"
    case "converting":
      return "Converting"
    default:
      return "Pending"
  }
}

function getQueueStatusClasses(status: QueueStatus) {
  switch (status) {
    case "uploading":
      return "border-border bg-background/50 text-foreground"
    case "checking":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400"
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    case "failed":
      return "border-destructive/30 bg-destructive/10 text-destructive"
    case "converting":
      return "border-primary/30 bg-primary/10 text-primary"
    default:
      return "border-border bg-background/50 text-foreground"
  }
}

export function Dashboard({ credentials, onDisconnect }: DashboardProps) {
  // State Antrean (Queue)
  const [queue, setQueue] = useState<QueueItem[]>([])
  
  // Discord webhook settings
  const [webhookUrl, setWebhookUrl] = useState("")
  const [discordUser, setDiscordUser] = useState("")
  const [showWebhook, setShowWebhook] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<QueueItem[]>([])

  useEffect(() => {
    try {
      setWebhookUrl(localStorage.getItem("hx_discord_webhook") ?? "")
      setDiscordUser(localStorage.getItem("hx_discord_user") ?? "")
    } catch {}
  }, [])

  // Mencegah memory leak dari objectURL audio preview
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    return () => {
      queueRef.current.forEach((item) => {
        URL.revokeObjectURL(item.objectUrl)
        if (item.convertedObjectUrl) URL.revokeObjectURL(item.convertedObjectUrl)
      })
    }
  }, [])

  const saveWebhookSettings = () => {
    try {
      localStorage.setItem("hx_discord_webhook", webhookUrl.trim())
      localStorage.setItem("hx_discord_user", discordUser.trim())
      setSavedNotice(true)
      setTimeout(() => setSavedNotice(false), 2000)
    } catch {}
  }

  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item))
  }

  const removeQueueItem = (id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id)
      if (item) URL.revokeObjectURL(item.objectUrl)
      return prev.filter(i => i.id !== id)
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newItems: QueueItem[] = files.map((file) => {
      const objectUrl = URL.createObjectURL(file)
      const newItemId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      const audio = new Audio()
      audio.preload = "metadata"
      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration)) {
          updateQueueItem(newItemId, { duration: audio.duration })
        }
      }
      audio.src = objectUrl

      return {
        id: newItemId,
        file,
        title: file.name.replace(/\.[^/.]+$/, ""),
        duration: null,
        amplify: ACCENT_SETTINGS.amplify.default,
        speed: ACCENT_SETTINGS.speed.default,
        preset: "default",
        status: "pending",
        assetId: null,
        errorMessage: null,
        objectUrl,
        convertedObjectUrl: null,
      }
    })

    setQueue((prev) => [...prev, ...newItems])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleConvert = async (id: string) => {
    const currentItem = queueRef.current.find((item) => item.id === id)
    if (!currentItem) return

    updateQueueItem(id, { status: "converting", assetId: null, errorMessage: null })

    try {
      if (currentItem.convertedObjectUrl) {
        URL.revokeObjectURL(currentItem.convertedObjectUrl)
      }

      const convertedUrl = await convertAudioFile(currentItem.file, currentItem.preset)
      updateQueueItem(id, { status: "pending", convertedObjectUrl: convertedUrl })
    } catch (err) {
      updateQueueItem(id, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Conversion failed.",
      })
    }
  }

  const handleUpload = async (item: QueueItem) => {
    updateQueueItem(item.id, { status: "uploading", assetId: null, errorMessage: null })

    try {
      const roundedDuration = item.duration === null ? null : Math.round(item.duration)
      const clampedDuration = roundedDuration === null ? null : roundedDuration > MAX_DURATION_SECONDS ? MAX_RENDER_DURATION_SECONDS : roundedDuration
      const convertedDuration = clampedDuration === null ? null : Math.round(clampedDuration / item.speed)
      const details = [
        `Speed: ${item.speed.toFixed(1)}x`,
        `Amplify: ${item.amplify.toFixed(1)}x`,
        `Duration: ${convertedDuration === null ? "auto" : formatDuration(convertedDuration)}`,
      ].join(" | ")

      let uploadFile: File
      if (item.convertedObjectUrl) {
        const response = await fetch(item.convertedObjectUrl as string)
        const blob = await response.blob()
        const ext = blob.type.includes("mpeg") ? "mp3" : "wav"
        const fileName = `${item.file.name.replace(/\.[^/.]+$/, "")}.${ext}`
        uploadFile = new File([blob], fileName, { type: blob.type || "audio/wav" })
      } else {
        uploadFile = item.file
      }

      // Roblox Open Cloud enforces a ~50MB maximum request body. If file is too large,
      // attempt to auto-convert/resample/encode (using convertAudioFile) and retry once.
      if (uploadFile.size > MAX_ROBLOX_BYTES) {
        if (!item.convertedObjectUrl) {
          updateQueueItem(item.id, { status: "converting" })
          try {
            const convertedUrl = await convertAudioFile(item.file, item.preset)
            updateQueueItem(item.id, { convertedObjectUrl: convertedUrl, status: "pending" })
            const response = await fetch(convertedUrl)
            const blob = await response.blob()
            const ext = blob.type.includes("mpeg") ? "mp3" : "wav"
            const fileName = `${item.file.name.replace(/\.[^/.]+$/, "")}.${ext}`
            uploadFile = new File([blob], fileName, { type: blob.type || "audio/wav" })
          } catch (e) {
            updateQueueItem(item.id, {
              status: "failed",
              errorMessage: e instanceof Error ? e.message : "Conversion failed.",
            })
            return
          }
        }

        if (uploadFile.size > MAX_ROBLOX_BYTES) {
          const msg = `File too large for Roblox upload (\nSize: ${Math.round(uploadFile.size / 1024 / 1024)} MB\nLimit: 50 MB). Try trimming the track or using a lower sample rate/preset.`
          updateQueueItem(item.id, {
            status: "failed",
            errorMessage: msg,
          })
          return
        }
      }

      const formData = new FormData()
      formData.append("apiKey", credentials.apiKey)
      formData.append("groupId", credentials.groupId)
      formData.append("title", item.title.trim() || item.file.name)
      formData.append("file", uploadFile)
      formData.append("details", details)
      if (webhookUrl.trim()) formData.append("webhookUrl", webhookUrl.trim())
      if (discordUser.trim()) formData.append("discordUser", discordUser.trim())

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.success) {
        updateQueueItem(item.id, {
          status: "failed",
          errorMessage: data?.error || `Upload failed (status ${res.status}).`,
        })
        return
      }

      if (data.assetId) {
        updateQueueItem(item.id, {
          status: "success",
          assetId: String(data.assetId),
          errorMessage: null,
        })
        return
      }

      updateQueueItem(item.id, {
        status: "checking",
        assetId: null,
        errorMessage: data?.message || "Roblox is still processing the asset. It may take a few minutes to appear in the Audio Asset Manager.",
      })
    } catch (err) {
      updateQueueItem(item.id, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Network error during upload.",
      })
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert("Asset ID Copied!")
    } catch {}
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
      {/* Profile widget (100% Original UI) */}
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-lg shadow-black/20 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <User className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Akun Roblox</span>
            <span className="text-sm font-semibold leading-tight">Linked User</span>
            <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              Status: Linked
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden flex-col text-right sm:flex">
            <span className="text-[11px] text-muted-foreground">Group ID</span>
            <span className="font-mono text-sm">{credentials.groupId}</span>
          </div>
          <Button variant="outline" onClick={onDisconnect} className="h-9 gap-2 border-border bg-transparent text-sm">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Disconnect
          </Button>
        </div>
      </header>

      {/* Discord webhook settings (100% Original UI) */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Discord Notifications</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Get a rich embed in your Discord server for every upload&apos;s final status. Saved securely in this browser.
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="webhookUrl" className="text-sm font-medium">Discord Webhook URL</label>
            <div className="relative">
              <input
                id="webhookUrl"
                type={showWebhook ? "text" : "password"}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="h-11 w-full rounded-xl border border-border bg-background/50 pl-3 pr-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40"
              />
              <button
                type="button"
                onClick={() => setShowWebhook((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="discordUser" className="text-sm font-medium">Discord Username</label>
            <input
              id="discordUser"
              type="text"
              value={discordUser}
              onChange={(e) => setDiscordUser(e.target.value)}
              placeholder="e.g. hxteam_admin"
              className="h-11 w-full rounded-xl border border-border bg-background/50 px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <Button variant="outline" onClick={saveWebhookSettings} className="h-10 w-fit gap-2 border-border bg-transparent text-sm">
            {savedNotice ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Bell className="h-4 w-4" />}
            {savedNotice ? "Saved" : "Save Settings"}
          </Button>
        </div>
      </section>

      {/* Zona Upload Baru (Menambahkan ke Antrean) */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Audio Queue Uploader</h2>
          </div>
          <span className="text-xs text-muted-foreground font-semibold bg-background/50 px-3 py-1 rounded-full border border-border">
             {queue.length} items in queue
          </span>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple // Memungkinkan pilih banyak file sekaligus!
          accept=".mp3,.ogg,audio/mpeg,audio/ogg"
          onChange={handleFileChange}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/40 p-8 text-center transition hover:border-ring hover:bg-background/60"
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">Click to select audio files</span>
          <span className="text-xs text-muted-foreground">Supports .mp3 and .ogg (You can select multiple)</span>
        </button>
      </section>

      {/* Daftar Antrean (Menggunakan 100% Desain Asli v0) */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-6">
          {queue.map((item) => {
            const isBusy = item.status === "converting" || item.status === "uploading";
            const canUpload = item.status === "pending" || item.status === "failed" || item.status === "checking";
            const finalDuration = item.duration === null ? null : Math.min(item.duration, MAX_RENDER_DURATION_SECONDS);
            const willTrim = item.duration !== null && item.duration > MAX_DURATION_SECONDS;

            return (
              <section key={item.id} className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/20 sm:p-6 relative">
                {!isBusy && item.status !== "success" && (
                  <button 
                    onClick={() => removeQueueItem(item.id)}
                    className="absolute top-5 right-5 text-muted-foreground hover:text-destructive transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}

                <div className="mb-4 pr-8 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Audio Title</label>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${getQueueStatusClasses(item.status)}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {getQueueStatusLabel(item.status)}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateQueueItem(item.id, { title: e.target.value })}
                    disabled={isBusy}
                    className="h-11 w-full rounded-xl border border-border bg-background/50 px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
                  />
                </div>

                <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-background/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <FileAudio className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.file.name}</p>
                      <p className="text-xs text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Normal</p>
                    <audio controls src={item.objectUrl} className="mt-2 h-9 w-full rounded-md opacity-80" />
                  </div>
                  {item.convertedObjectUrl ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Converted</p>
                      <audio controls src={item.convertedObjectUrl} className="h-9 w-full rounded-md opacity-80" />
                    </div>
                  ) : null}
                </div>

                <div className="mb-6 flex flex-col gap-5 rounded-xl border border-border bg-background/40 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Music4 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">Converter Settings</h3>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Preset</span>
                    </div>
                    <select
                      value={item.preset}
                      onChange={(e) => updateQueueItem(item.id, { preset: e.target.value })}
                      disabled={isBusy}
                      className="h-11 w-full rounded-xl border border-border bg-background/50 px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
                    >
                      <option value="default">Default</option>
                      <option value="nightcore">Nightcore</option>
                      <option value="slowed">Slowed</option>
                      <option value="vaporwave">Vaporwave</option>
                      <option value="down-a-whole-step">Down a whole step</option>
                      <option value="up-a-whole-step">Up a whole step</option>
                      <option value="chipmunk">Chipmunk</option>
                      <option value="deep-bass">Deep bass</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Duration</span>
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                        {finalDuration === null ? "--:--" : formatDuration(finalDuration)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.duration === null
                        ? "Auto-matched to the song length."
                        : willTrim
                          ? `Track is ${formatDuration(item.duration)} — it will be trimmed to under 7:00.`
                          : `Matched to the full song length (${formatDuration(item.duration)}).`}
                    </p>
                  </div>
                  <SliderRow
                    id={`amplify-${item.id}`}
                    label="Amplify"
                    value={item.amplify}
                    display={`${item.amplify.toFixed(1)}${ACCENT_SETTINGS.amplify.unit}`}
                    min={ACCENT_SETTINGS.amplify.min}
                    max={ACCENT_SETTINGS.amplify.max}
                    step={ACCENT_SETTINGS.amplify.step}
                    onChange={(val) => updateQueueItem(item.id, { amplify: val })}
                    disabled={isBusy}
                  />
                  <SliderRow
                    id={`speed-${item.id}`}
                    label="Speed"
                    value={item.speed}
                    display={`${item.speed.toFixed(1)}${ACCENT_SETTINGS.speed.unit}`}
                    min={ACCENT_SETTINGS.speed.min}
                    max={ACCENT_SETTINGS.speed.max}
                    step={ACCENT_SETTINGS.speed.step}
                    onChange={(val) => updateQueueItem(item.id, { speed: val })}
                    disabled={isBusy}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row mb-4">
                  <Button
                    onClick={() => handleConvert(item.id)}
                    disabled={!item.title.trim() || isBusy || item.status === "success"}
                    variant={item.status === "pending" && item.assetId ? "outline" : "default"}
                    className="h-11 flex-1 gap-2 text-sm font-semibold"
                  >
                    {item.status === "converting" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Converting...</>
                    ) : item.status === "pending" && item.assetId ? (
                      <><CheckCircle2 className="h-4 w-4" /> Converted</>
                    ) : (
                      <><Music4 className="h-4 w-4" /> Convert Audio</>
                    )}
                  </Button>

                  {canUpload && (
                    <Button
                      onClick={() => handleUpload(item)}
                      disabled={item.status === "uploading" || item.status === "success" || item.status === "converting"}
                      className="h-11 flex-1 gap-2 text-sm font-semibold"
                    >
                      {item.status === "uploading" ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                      ) : item.status === "checking" ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                      ) : item.status === "failed" ? (
                        <><Upload className="h-4 w-4" /> Retry Upload</>
                      ) : (
                        <><Upload className="h-4 w-4" /> Upload to Roblox</>
                      )}
                    </Button>
                  )}
                </div>

                {(item.status === "success" || item.status === "failed") && (
                  <div aria-live="polite">
                    {item.status === "success" && item.assetId && (
                      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                          <div>
                            <h3 className="font-semibold text-emerald-300">Upload successful</h3>
                            <p className="mt-1 text-sm text-emerald-200/80">Audio passed moderation.</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-background/40 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Roblox Asset ID</p>
                            <p className="truncate font-mono text-sm">rbxassetid://{item.assetId}</p>
                          </div>
                          <Button variant="outline" onClick={() => handleCopy(`rbxassetid://${item.assetId}`)} className="h-9 shrink-0 gap-2 border-emerald-500/30 bg-transparent text-sm">
                            <Copy className="h-4 w-4" /> Copy ID
                          </Button>
                        </div>
                      </div>
                    )}

                    {item.status === "failed" && (
                      <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                        <div>
                          <h3 className="font-semibold text-destructive">Upload failed.</h3>
                          <p className="mt-1 text-sm text-destructive/90">{item.errorMessage}</p>
                          <Button variant="outline" onClick={() => updateQueueItem(item.id, { status: "pending" })} className="mt-3 h-9 gap-2 border-destructive/40 bg-transparent text-sm text-destructive hover:text-destructive">
                            Adjust &amp; Retry
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  )
}

// 100% Original SliderRow Component from v0
type SliderRowProps = {
  id: string
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  disabled?: boolean
  hint?: string
}

function SliderRow({ id, label, value, display, min, max, step, onChange, disabled, hint }: SliderRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}