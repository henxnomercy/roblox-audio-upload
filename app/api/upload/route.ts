import { type NextRequest, NextResponse } from "next/server"

const ROBLOX_ASSETS_ENDPOINT = "https://apis.roblox.com/assets/v1/assets"
const ROBLOX_OPERATIONS_ENDPOINT = "https://apis.roblox.com/assets/v1/operations"

// Warna standar untuk Discord Webhook
const DISCORD_GREEN = 0x2ecc71
const DISCORD_RED = 0xe74c3c
const DISCORD_YELLOW = 0xf1c40f // Digunakan jika masih dalam antrean proses Roblox

type WebhookInput = {
  webhookUrl?: string
  discordUser?: string
  title: string
  accepted: boolean
  isProcessing?: boolean
  assetId?: string
  operationId?: string
  details?: string
  errorMessage?: string
}

// Fungsi pengirim Discord Webhook yang sudah ditingkatkan
async function sendDiscordWebhook({
  webhookUrl,
  discordUser,
  title,
  accepted,
  isProcessing,
  assetId,
  operationId,
  details,
  errorMessage,
}: WebhookInput) {
  if (!webhookUrl || !/^https?:\/\//i.test(webhookUrl)) return

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Title", value: title || "Untitled", inline: true },
    { name: "Uploader", value: discordUser?.trim() || "Unknown", inline: true },
  ]

  let statusText = accepted ? "✅ Accepted" : "❌ Failed"
  let embedColor = accepted ? DISCORD_GREEN : DISCORD_RED

  if (isProcessing) {
    statusText = "⏳ Processing / Pending"
    embedColor = DISCORD_YELLOW
  }
  
  fields.push({ name: "Status", value: statusText, inline: true })

  if (assetId) {
    fields.push({ name: "Asset ID", value: `\`rbxassetid://${assetId}\`` })
  } else if (operationId) {
    fields.push({ name: "Operation ID", value: `\`${operationId}\``, inline: true })
  }

  if (!accepted && errorMessage) {
    const rawMessage = String(errorMessage)
    const clippedMessage = rawMessage.length > 900 ? `${rawMessage.slice(0, 900)}...` : rawMessage
    fields.push({ name: "Reason", value: clippedMessage })
  }
  if (details) {
    fields.push({ name: "Details", value: details })
  }

  const payload = {
    embeds: [
      {
        title: "🎵 Audio Upload Status",
        color: embedColor,
        fields,
        footer: { text: "HXTeam Audio Integration System" },
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error("[Webhook Error] Gagal mengirim ke Discord:", err)
  }
}

// Fungsi pembantu: Smart Polling untuk menunggu Roblox selesai memproses audio
async function pollForAssetId(operationId: string, apiKey: string, maxAttempts = 8): Promise<string | undefined> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    try {
      const res = await fetch(`${ROBLOX_OPERATIONS_ENDPOINT}/${operationId}`, {
        headers: { "x-api-key": apiKey },
      })
      if (!res.ok) continue

      const data = await res.json()
      const assetId = data?.response?.assetId || data?.response?.asset?.id || data?.assetId || data?.id
      if (assetId) {
        return String(assetId)
      }
    } catch (e) {
      // Abaikan error jaringan sementara saat polling
    }
  }
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()

    const apiKey = form.get("apiKey")
    const groupId = form.get("groupId")
    const title = form.get("title")
    const audio = form.get("file")

    const webhookUrl = typeof form.get("webhookUrl") === "string" ? form.get("webhookUrl") as string : undefined
    const discordUser = typeof form.get("discordUser") === "string" ? form.get("discordUser") as string : undefined
    const details = typeof form.get("details") === "string" ? form.get("details") as string : undefined
    const titleStr = typeof title === "string" ? title.trim() : "AudioUpload"

    if (typeof apiKey !== "string" || !apiKey.trim()) return NextResponse.json({ error: "Missing API key." }, { status: 400 })
    if (typeof groupId !== "string" || !groupId.trim()) return NextResponse.json({ error: "Missing Group ID." }, { status: 400 })
    if (!(audio instanceof File)) return NextResponse.json({ error: "Missing audio file." }, { status: 400 })

    const requestPayload = {
      assetType: "Audio",
      creationContext: { creator: { groupId: groupId.trim() } },
      displayName: titleStr,
      description: "Uploaded by HXTeam",
    }

    const robloxForm = new FormData()
    robloxForm.append("request", JSON.stringify(requestPayload))
    robloxForm.append("fileContent", audio, audio.name)

    // Debug: tunjukkan payload sebelum mengirim ke Roblox
    console.log("Payload yang dikirim ke Roblox:", {
      groupId: groupId.trim(),
      title: titleStr,
      hasFile: audio instanceof File,
      fileName: audio instanceof File ? audio.name : "null",
    })

    // Tembak API Roblox
    const robloxRes = await fetch(ROBLOX_ASSETS_ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey.trim() },
      body: robloxForm,
    })

    // Debug: tampilkan respon mentah dari Roblox untuk membantu debugging
    const raw = await robloxRes.text()
    console.log("Respon asli dari Roblox:", raw)
    let data: any = null
    try { data = raw ? JSON.parse(raw) : null } catch { data = raw }

    // Jika Gagal Upload
    if (!robloxRes.ok) {
      const message = data?.message || data?.error || data?.errors?.[0]?.message || (typeof data === "string" && data) || `Roblox API returned status ${robloxRes.status}.`
      
      await sendDiscordWebhook({
        webhookUrl, discordUser, title: titleStr, accepted: false, details, errorMessage: message,
      })
      return NextResponse.json({ error: message }, { status: robloxRes.status })
    }

    // Jika Berhasil Upload, coba cari Asset ID atau Operation ID
    const operationId: string | undefined = data?.operationId || data?.path?.split("/").pop()
    let assetId: string | undefined = data?.response?.assetId || data?.assetId || data?.id

    // Jika Roblox belum memberikan Asset ID, lakukan Smart Polling
    if (!assetId && operationId) {
      assetId = await pollForAssetId(operationId, apiKey.trim())
    }

    // Jika Asset ID berhasil didapatkan (entah langsung atau lewat polling)
    if (assetId) {
      await sendDiscordWebhook({
        webhookUrl, discordUser, title: titleStr, accepted: true, assetId, details,
      })
      return NextResponse.json({ success: true, assetId }, { status: 200 })
    }

    // Jika waktu polling habis tapi Roblox masih memproses
    await sendDiscordWebhook({
      webhookUrl, discordUser, title: titleStr, accepted: true, isProcessing: true, operationId, details,
    })

    return NextResponse.json(
      { success: true, operationId, message: "Upload accepted. Roblox is still processing the asset and it may take a few minutes to appear in the Audio Asset Manager." },
      { status: 200 }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error."
    console.error("[Upload Route Error]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}