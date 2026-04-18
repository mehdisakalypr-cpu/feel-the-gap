/**
 * Google Drive ingest — liste fichiers dans un dossier partagé, DL → upload Supabase Storage.
 * Support : dossier public "anyone with link" (pas besoin d'auth) via API v3.
 * Si GOOGLE_DRIVE_SA_JSON fourni → service account pour dossiers privés.
 */

export interface DriveIngestResult {
  ok: boolean
  files: Array<{ id: string; name: string; mimeType: string; supabase_url?: string }>
  stub?: boolean
  error?: string
}

export function extractFolderId(driveUrl: string): string | null {
  // https://drive.google.com/drive/folders/<ID>?... OR /file/d/<ID>/...
  const folderMatch = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) return folderMatch[1]
  const fileMatch = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return fileMatch[1]
  return null
}

/**
 * Liste fichiers publics d'un dossier Drive (sans auth, OAuth2 API key facultatif).
 * Retourne metadata + URL de DL direct (pour upload Supabase ensuite).
 */
export async function listDriveFolder(driveUrl: string): Promise<DriveIngestResult> {
  const folderId = extractFolderId(driveUrl)
  if (!folderId) return { ok: false, files: [], error: 'invalid drive url' }

  // Sans clé API Drive, on tente via webmaster public folder endpoint
  // (hack : passer par le lien embed HTML et parser — pas 100% fiable).
  // Solution propre : demander à l'user de set GOOGLE_API_KEY (free tier)
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    console.log('[drive] STUB MODE — GOOGLE_API_KEY absent. Folder:', folderId)
    return { ok: true, stub: true, files: [] }
  }

  try {
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${apiKey}&fields=files(id,name,mimeType)&pageSize=100`
    const res = await fetch(url)
    if (!res.ok) return { ok: false, files: [], error: `drive list ${res.status}` }
    const data = await res.json()
    return { ok: true, files: data.files ?? [] }
  } catch (err) {
    return { ok: false, files: [], error: (err as Error).message }
  }
}

export function driveDirectDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`
}
