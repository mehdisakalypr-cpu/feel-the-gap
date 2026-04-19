import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import Link from 'next/link'

export const dynamic = 'force-static'
export const revalidate = 86400

const OWNER_NAME = 'Mehdi Sakaly'
const OWNER_EMAIL = 'mehdi.sakalypr@gmail.com'
const PROJECT = 'feel-the-gap'
const PROJECT_FINGERPRINT = '66d440006ffee21786ba79e378cd021a'

type ManifestFile = { path: string; sha256: string }
type Manifest = {
  project: string
  owner: { name: string; email: string }
  fingerprint: string
  generated_at: string
  files: ManifestFile[]
}

function loadManifest(): Manifest | null {
  try {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'MANIFEST.authorship.json'), 'utf8'))
    return data as Manifest
  } catch { return null }
}

function manifestHash(): string | null {
  try {
    const buf = readFileSync(join(process.cwd(), 'MANIFEST.authorship.json'))
    return createHash('sha256').update(buf).digest('hex')
  } catch { return null }
}

const C = {
  bg: '#07090F', card: '#0D1117', border: 'rgba(201,168,76,.25)',
  gold: '#C9A84C', text: '#E5E7EB', muted: 'rgba(255,255,255,.6)',
}

export default function AuthorshipPage() {
  const manifest = loadManifest()
  const hash = manifestHash()

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ fontSize: 11, color: C.gold, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 8 }}>
          Notice legale — provenance et propriete intellectuelle
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px', color: '#fff' }}>
          Acte de declaration d'auteur
        </h1>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>
          Feel The Gap — Project fingerprint <code style={{ color: C.gold }}>{PROJECT_FINGERPRINT}</code>
        </div>

        <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#fff' }}>1. Titulaire des droits</h2>
          <div style={{ fontSize: 14, lineHeight: 1.65 }}>
            <strong style={{ color: C.gold }}>{OWNER_NAME}</strong><br />
            <a href={`mailto:${OWNER_EMAIL}`} style={{ color: C.muted, textDecoration: 'none' }}>{OWNER_EMAIL}</a><br />
            <span style={{ color: C.muted }}>
              Auteur, concepteur, directeur technique et titulaire exclusif des
              droits de propriete intellectuelle sur le logiciel, son architecture,
              ses specifications, son modele economique et ses assets.
            </span>
          </div>
        </section>

        <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#fff' }}>2. Declaration d'assistance par IA</h2>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: C.muted }}>
            Le present logiciel a ete developpe avec l'assistance ponctuelle de
            modeles Claude (Anthropic PBC, San Francisco, USA) agissant sous
            direction exclusive de l'Auteur. L'outil d'intelligence artificielle
            est un instrument de redaction, sans personnalite juridique. Aucun
            droit n'est confere a l'operateur de l'outil ni a l'outil lui-meme.
            Cette declaration est conforme aux recommandations WIPO, eIDAS et
            USPTO sur l'AI-assisted authorship.
          </div>
        </section>

        <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#fff' }}>3. Manifeste horodate</h2>
          {manifest ? (
            <div style={{ fontSize: 13, lineHeight: 1.65 }}>
              <div style={{ color: C.muted, marginBottom: 8 }}>
                Fichiers sources horodates : <strong style={{ color: C.text }}>{manifest.files.length}</strong><br />
                Date de generation : <strong style={{ color: C.text }}>{manifest.generated_at}</strong><br />
                SHA-256 du manifeste :
              </div>
              <code style={{ color: C.gold, fontSize: 11, wordBreak: 'break-all', display: 'block', background: '#07090F', padding: 10, borderRadius: 6 }}>
                {hash ?? '(non disponible)'}
              </code>
              <div style={{ color: C.muted, marginTop: 12, fontSize: 12 }}>
                Ce hash cryptographique atteste l'etat exact du code source
                a la date de generation. Il est horodate sur la blockchain
                Bitcoin via le protocole OpenTimestamps, et depose a
                l'INPI (e-Soleau, France).
              </div>
            </div>
          ) : (
            <div style={{ color: C.muted, fontSize: 13 }}>Manifeste absent sur ce deploiement.</div>
          )}
        </section>

        <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#fff' }}>4. Licence & interdictions</h2>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: C.muted }}>
            Licence propriétaire <code style={{ color: C.gold }}>LicenseRef-Proprietary-Sakaly</code>.
            Sont <strong style={{ color: '#fff' }}>strictement interdites</strong> sans autorisation
            ecrite de l'Auteur :
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              <li>la reproduction totale ou partielle, publique ou privee</li>
              <li>la modification ou la creation d'oeuvres derivees</li>
              <li>l'exploitation commerciale ou non commerciale</li>
              <li>le reverse engineering</li>
              <li>l'utilisation pour l'entrainement de tout systeme d'apprentissage automatique</li>
            </ul>
          </div>
        </section>

        <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#fff' }}>5. Endpoints de verification</h2>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
            <div>
              Donnees structurees (JSON) :
              {' '}
              <Link href="/api/_authorship" style={{ color: C.gold, fontFamily: 'monospace' }}>/api/_authorship</Link>
            </div>
            <div style={{ marginTop: 10 }}>
              Tout signalement d'usage non autorise :
              {' '}
              <a href={`mailto:${OWNER_EMAIL}`} style={{ color: C.gold }}>{OWNER_EMAIL}</a>
            </div>
          </div>
        </section>

        <div style={{ marginTop: 32, fontSize: 11, color: C.muted, textAlign: 'center' }}>
          Project {PROJECT} · Fingerprint {PROJECT_FINGERPRINT} · Page generee statiquement, revalidee quotidiennement
        </div>
      </div>
    </div>
  )
}
