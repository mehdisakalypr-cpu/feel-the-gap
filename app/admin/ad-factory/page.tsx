import Link from 'next/link'

export const metadata = { title: 'Ad Factory — Admin FTG' }

const C = { bg: '#07090F', card: '#0F172A', border: 'rgba(201,168,76,.2)', accent: '#C9A84C', text: '#E2E8F0', muted: '#94A3B8' }

export default function AdFactoryHome() {
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ fontSize: 11, color: C.accent, letterSpacing: '.22em', textTransform: 'uppercase' }}>Admin · FTG</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: '6px 0 12px' }}>Ad Factory</h1>
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6, marginBottom: 32, maxWidth: 700 }}>
          Pipeline complet de génération d'ads vidéo FTG. Crée des avatars IA (nano-banana + Flux cascade),
          assemble des scénarios (Drive refs + briefs), dispatche en variants multi-langues, et télécharge les mp4 finaux.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <Card href="/admin/ad-factory/avatars" icon="🎭" title="Avatar Factory" desc="Génère des avatars IA à partir de texte (4 previews · 3 providers cascade). Bibliothèque réutilisable." enabled />
          <Card href="/admin/ad-factory/projects" icon="🎬" title="Projets" desc="Scénarios sources (brief + segments + Drive assets + aspect ratio). 1 projet = N variants." enabled={false} />
          <Card href="/admin/ad-factory/jobs" icon="⚙️" title="Jobs de rendu" desc="Queue de pipeline. Status par segment + progress + URLs finales + download mp4." enabled={false} />
        </div>

        <div style={{ marginTop: 48, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Status providers</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 12 }}>
            <StatusCell name="Gemini 2.5 Flash Image" envs={['GOOGLE_GENERATIVE_AI_API_KEY']} />
            <StatusCell name="Cloudflare Flux" envs={['CF_ACCOUNT_ID', 'CF_API_KEY']} />
            <StatusCell name="Seedance 2" envs={['SEEDANCE_API_KEY']} />
            <StatusCell name="ElevenLabs" envs={['ELEVENLABS_API_KEY']} />
            <StatusCell name="HeyGen" envs={['HEYGEN_API_KEY']} />
            <StatusCell name="Supabase Storage" envs={['SUPABASE_SERVICE_ROLE_KEY']} />
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 12 }}>
            Les providers manquants passent en stub mode automatique (workflow tourne, génération skippée).
            Ajoute les clés dans Vercel env vars pour activer chaque brique.
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ href, icon, title, desc, enabled }: { href: string; icon: string; title: string; desc: string; enabled: boolean }) {
  const content = (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24,
      opacity: enabled ? 1 : 0.5, cursor: enabled ? 'pointer' : 'not-allowed',
      transition: 'all .2s',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{desc}</div>
      {!enabled && <div style={{ fontSize: 10, color: C.accent, marginTop: 10, letterSpacing: '.1em', textTransform: 'uppercase' }}>Bientôt</div>}
    </div>
  )
  return enabled ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : content
}

function StatusCell({ name, envs }: { name: string; envs: string[] }) {
  // server-side simple check (sera affiché au build)
  const ok = envs.every(e => process.env[e])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: ok ? '#10B981' : '#94A3B8' }}>{ok ? '●' : '○'}</span>
      <span style={{ color: C.text }}>{name}</span>
      <span style={{ color: C.muted, fontSize: 10 }}>{ok ? 'actif' : 'stub'}</span>
    </div>
  )
}
