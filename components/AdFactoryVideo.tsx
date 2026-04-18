/**
 * AdFactoryVideo — composant embed réutilisable cross-sites.
 * Auto-responsive : charge 9:16 sur mobile, 4:5 sur tablet, 16:9 sur desktop.
 *
 * Usage OFA site : <AdFactoryVideo variantId="..." section="hero" autoplay muted />
 * Usage FTG landing : <AdFactoryVideo variantId="..." posterImage="..." />
 */

'use client'

import { useEffect, useState } from 'react'

export interface AdFactoryVideoProps {
  variantId: string
  section?: string
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  controls?: boolean
  posterImage?: string
  className?: string
  style?: React.CSSProperties
  onLoaded?: () => void
}

type OutputRow = { aspect_ratio: string; url: string; resolution?: string }

export default function AdFactoryVideo({
  variantId, section, autoplay = true, muted = true, loop = true,
  controls = false, posterImage, className, style, onLoaded,
}: AdFactoryVideoProps) {
  const [outputs, setOutputs] = useState<OutputRow[]>([])
  const [posterUrl, setPosterUrl] = useState<string | undefined>(posterImage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!variantId) return
    let cancelled = false
    fetch(`/api/ad-factory/outputs?variant_id=${variantId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.ok) {
          const list = (d.outputs ?? []) as OutputRow[]
          setOutputs(list.filter(o => o.aspect_ratio && o.url && o.aspect_ratio !== 'poster'))
          const poster = list.find(o => o.aspect_ratio === 'poster')
          if (poster?.url) setPosterUrl(poster.url)
        } else {
          setError(d.error || 'no outputs')
        }
      })
      .catch(e => setError(e.message))
      .finally(() => { if (!cancelled) setLoading(false); onLoaded?.() })
    return () => { cancelled = true }
  }, [variantId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className={className} style={{ aspectRatio: '9/16', background: '#111', ...style }} data-section={section} />
  }
  if (error || outputs.length === 0) {
    if (posterUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={posterUrl} alt="" className={className} style={style} />
    }
    return null
  }

  const byAspect = (a: string) => outputs.find(o => o.aspect_ratio === a)?.url

  return (
    <video
      className={className}
      style={style}
      autoPlay={autoplay}
      muted={muted}
      loop={loop}
      controls={controls}
      playsInline
      poster={posterUrl}
      preload="metadata"
      data-section={section}
    >
      {/* Mobile portrait */}
      {byAspect('9:16') && <source media="(max-width: 768px)" src={byAspect('9:16')!} type="video/mp4" />}
      {/* Tablet portrait */}
      {byAspect('4:5') && <source media="(max-width: 1024px)" src={byAspect('4:5')!} type="video/mp4" />}
      {/* Desktop landscape */}
      {byAspect('16:9') && <source src={byAspect('16:9')!} type="video/mp4" />}
      {/* Fallback */}
      {byAspect('1:1') && <source src={byAspect('1:1')!} type="video/mp4" />}
    </video>
  )
}
