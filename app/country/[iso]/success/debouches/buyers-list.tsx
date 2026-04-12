'use client'
import { useState } from 'react'

type Buyer = {
  id: string; name: string; buyer_type: string; city: string | null; address: string | null;
  website_url: string | null; email: string | null; phone: string | null; whatsapp: string | null;
  contact_name: string | null; product_slugs: string[];
  annual_volume_mt_min: number | null; annual_volume_mt_max: number | null;
  quality_requirements: string | null; certifications_required: string[] | null;
  confidence_score: number | null; verified: boolean; notes: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  industriel: 'Industriel', grossiste: 'Grossiste', centrale_achats: 'Centrale d\'achats',
  transformateur: 'Transformateur', distributeur: 'Distributeur', horeca: 'HORECA',
  export_trader: 'Trader export',
}

const TYPE_COLOR: Record<string, string> = {
  industriel: '#3B82F6', grossiste: '#10B981', centrale_achats: '#8B5CF6',
  transformateur: '#F59E0B', distributeur: '#06B6D4', horeca: '#EF4444',
  export_trader: '#EC4899',
}

export default function BuyersList({ buyers }: { buyers: Buyer[] }) {
  const [filter, setFilter] = useState<string>('all')
  const types = Array.from(new Set(buyers.map(b => b.buyer_type)))
  const filtered = filter === 'all' ? buyers : buyers.filter(b => b.buyer_type === filter)

  return (
    <div>
      {types.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${filter === 'all' ? 'bg-white/20' : 'bg-white/5 border border-white/10'}`}>
            Tous ({buyers.length})
          </button>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${filter === t ? 'text-black' : 'text-white bg-white/5 border border-white/10'}`}
              style={filter === t ? { background: TYPE_COLOR[t] ?? '#C9A84C' } : {}}>
              {TYPE_LABEL[t] ?? t} ({buyers.filter(b => b.buyer_type === t).length})
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(b => (
          <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-white/25 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <b className="text-sm">{b.name}</b>
                  {b.verified && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">✓ vérifié</span>}
                </div>
                <div className="text-[11px] uppercase tracking-wider opacity-60 mt-1" style={{ color: TYPE_COLOR[b.buyer_type] ?? undefined }}>
                  {TYPE_LABEL[b.buyer_type] ?? b.buyer_type}
                  {b.city && <span className="opacity-80"> · {b.city}</span>}
                </div>
              </div>
            </div>

            {b.product_slugs?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {b.product_slugs.slice(0, 5).map(p => (
                  <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{p}</span>
                ))}
              </div>
            )}

            {(b.annual_volume_mt_min || b.annual_volume_mt_max) && (
              <div className="text-xs opacity-80 mb-1">
                Volume : {b.annual_volume_mt_min ?? '?'}{b.annual_volume_mt_max ? `-${b.annual_volume_mt_max}` : '+'} MT/an
              </div>
            )}
            {b.quality_requirements && <div className="text-xs opacity-70 mb-1">Qualité : {b.quality_requirements}</div>}

            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              {b.website_url && <a href={b.website_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10">🔗 Site</a>}
              {b.email && <a href={`mailto:${b.email}`} className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10">✉️ Email</a>}
              {b.phone && <a href={`tel:${b.phone}`} className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10">📞 {b.phone}</a>}
              {b.whatsapp && <a href={`https://wa.me/${b.whatsapp.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/30">💬 WhatsApp</a>}
            </div>

            {b.notes && <div className="text-[11px] opacity-50 mt-2 line-clamp-2">{b.notes}</div>}

            {!b.verified && b.confidence_score !== null && (
              <div className="text-[10px] opacity-40 mt-2">Confiance : {Math.round((b.confidence_score ?? 0) * 100)}% · à vérifier</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
