'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/Topbar'

// Page: /seller/products/[id]/ads — génère et liste les variantes multi-format
// pour les publicités sur réseaux sociaux, via FFmpeg côté serveur.

interface AdVariant {
  id: string
  product_id: string | null
  source_video_url: string
  ratio: '9:16' | '1:1' | '16:9' | '4:5'
  output_url: string | null
  duration_sec: number | null
  width: number | null
  height: number | null
  file_size_bytes: number | null
  status: 'queued' | 'generating' | 'ready' | 'failed'
  error_message: string | null
  created_at: string
}

const RATIO_META: Record<AdVariant['ratio'], { label: string; platforms: string[]; icon: string; color: string }> = {
  '9:16': {
    label: '9:16 Vertical',
    platforms: ['Instagram Reels', 'Stories', 'TikTok', 'YouTube Shorts'],
    icon: '📱',
    color: '#EC4899',
  },
  '1:1': {
    label: '1:1 Carré',
    platforms: ['Instagram Feed', 'Facebook Feed'],
    icon: '🟪',
    color: '#A78BFA',
  },
  '16:9': {
    label: '16:9 Horizontal',
    platforms: ['YouTube classique', 'LinkedIn', 'Twitter / X'],
    icon: '🖥️',
    color: '#60A5FA',
  },
  '4:5': {
    label: '4:5 Portrait',
    platforms: ['Instagram Feed (portrait)', 'Facebook Feed'],
    icon: '🖼️',
    color: '#34D399',
  },
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return (bytes / 1e3).toFixed(0) + ' KB'
}

export default function AdVariantsPage() {
  const params = useParams()
  const productId = params?.id as string

  const [variants, setVariants] = useState<AdVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceUrl, setSourceUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [product, setProduct] = useState<{ name: string } | null>(null)

  // Load existing variants
  useEffect(() => {
    fetch(`/api/seller/ad-variants?product_id=${productId}`)
      .then((r) => r.json())
      .then((j) => setVariants(j.variants ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    // Fetch product name for display (best-effort)
    fetch(`/api/catalog/products?category=all`)
      .then((r) => r.json())
      .then((j) => {
        const p = (j.products ?? []).find((x: { id: string }) => x.id === productId)
        if (p) setProduct({ name: p.name })
      })
      .catch(() => {})
  }, [productId])

  async function generate() {
    if (!sourceUrl.trim()) {
      setError('Fournis une URL vidéo source (HeyGen, Arcads, ou lien direct mp4)')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/seller/ad-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          source_video_url: sourceUrl,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      // Reload full list
      const reload = await fetch(`/api/seller/ad-variants?product_id=${productId}`)
      const rj = await reload.json()
      setVariants(rj.variants ?? [])
      setSourceUrl('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const byRatio: Record<string, AdVariant | undefined> = {}
  for (const v of variants) byRatio[v.ratio] = v

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-xs text-gray-500 mb-2">
          <Link href="/seller" className="hover:text-gray-300">← Mes produits</Link>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Publicités multi-format
        </h1>
        <p className="text-gray-400 mb-8 max-w-2xl">
          Génère automatiquement les 4 variantes adaptées à Instagram, TikTok, YouTube et LinkedIn
          à partir d'une vidéo source (HeyGen, Arcads, ou upload direct).
          {product && <> Produit : <span className="text-white font-semibold">{product.name}</span></>}
        </p>

        {/* Source video input */}
        <div className="rounded-3xl p-6 mb-8"
          style={{ background: '#0D1117', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Vidéo source</div>
          <div className="flex gap-3 flex-col md:flex-row">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://exemple.com/ma-video.mp4"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#A78BFA]/50"
            />
            <button
              onClick={generate}
              disabled={generating || !sourceUrl.trim()}
              className="px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', color: '#07090F' }}
            >
              {generating ? '⚙️ Génération… (60s)' : '✨ Générer les 4 variantes'}
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">
            FFmpeg produit automatiquement 9:16 (Reels/TikTok), 1:1 (Feed), 16:9 (YouTube/LinkedIn), 4:5 (Portrait).
            Arrière-plan flou si le ratio source ne correspond pas.
          </p>
        </div>

        {error && (
          <div className="rounded-xl p-3 mb-4 text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Variants grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(['9:16', '1:1', '16:9', '4:5'] as const).map((ratio) => {
            const meta = RATIO_META[ratio]
            const variant = byRatio[ratio]
            const isReady = variant?.status === 'ready' && variant.output_url
            const isGenerating = generating || variant?.status === 'generating' || variant?.status === 'queued'
            const isFailed = variant?.status === 'failed'

            return (
              <div
                key={ratio}
                className="rounded-3xl p-5"
                style={{
                  background: '#0D1117',
                  border: `1px solid ${meta.color}25`,
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}40` }}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white">{meta.label}</div>
                    <div className="text-[10px] text-gray-500">{meta.platforms.join(' · ')}</div>
                  </div>
                  {isReady && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#34D39920', color: '#34D399' }}>PRÊT</span>
                  )}
                  {isGenerating && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#C9A84C20', color: '#C9A84C' }}>EN COURS</span>
                  )}
                  {isFailed && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#F9731620', color: '#F97316' }}>ÉCHEC</span>
                  )}
                </div>

                {/* Preview */}
                <div
                  className="rounded-xl overflow-hidden mb-3 flex items-center justify-center"
                  style={{
                    background: '#06080C',
                    border: '1px solid rgba(255,255,255,0.05)',
                    aspectRatio: ratio === '9:16' ? '9/16' : ratio === '16:9' ? '16/9' : ratio === '4:5' ? '4/5' : '1/1',
                    maxHeight: '360px',
                  }}
                >
                  {isReady && variant.output_url ? (
                    /* eslint-disable-next-line jsx-a11y/media-has-caption */
                    <video
                      src={variant.output_url}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-gray-600 text-xs text-center p-4">
                      {isGenerating ? (
                        <>
                          <div className="w-8 h-8 mx-auto mb-2 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: meta.color + ' transparent transparent transparent' }} />
                          Génération en cours…
                        </>
                      ) : isFailed ? (
                        <>
                          ⚠️ {variant?.error_message ?? 'Échec'}
                        </>
                      ) : (
                        <>
                          {meta.icon}<br />
                          En attente de génération
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Metadata + actions */}
                {isReady && variant.output_url && (
                  <>
                    <div className="text-[10px] text-gray-500 space-y-0.5 mb-3">
                      <div>📐 {variant.width}×{variant.height} · ⏱️ {variant.duration_sec?.toFixed(1)}s · 💾 {fmtSize(variant.file_size_bytes)}</div>
                    </div>
                    <a
                      href={variant.output_url}
                      download
                      className="block w-full py-2 rounded-xl font-bold text-xs text-center"
                      style={{ background: meta.color + '20', color: meta.color, border: `1px solid ${meta.color}40` }}
                    >
                      ⬇️ Télécharger la variante {ratio}
                    </a>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {loading && (
          <div className="text-center text-gray-500 text-sm mt-8">Chargement…</div>
        )}
      </div>
    </div>
  )
}
