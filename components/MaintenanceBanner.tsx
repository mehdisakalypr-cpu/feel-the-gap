// Bandeau maintenance générique — à coller dans chaque projet (FTG/OFA/CC/Estate/Consulting)
// Active via env var publique (visible client) :
//
//   vercel env add NEXT_PUBLIC_MAINTENANCE_MODE 1 production
//   vercel --prod --force --yes
//
// Désactive après la rotation :
//
//   vercel env rm NEXT_PUBLIC_MAINTENANCE_MODE production
//   vercel --prod --force --yes
//
// À wirer dans `app/layout.tsx` (Next.js App Router) :
//
//   import MaintenanceBanner from '@/components/MaintenanceBanner'
//   …
//   <body>
//     <MaintenanceBanner />
//     {children}
//   </body>

export default function MaintenanceBanner() {
  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE !== '1') return null

  const message = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE
    ?? 'Maintenance sécurité programmée — quelques minutes d\'instabilité possibles. Vos données ne sont pas affectées.'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)',
        color: '#1F2937',
        padding: '10px 16px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        textAlign: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,.15)',
      }}
    >
      <span style={{ marginRight: 8 }}>🛡️</span>
      {message}
    </div>
  )
}
