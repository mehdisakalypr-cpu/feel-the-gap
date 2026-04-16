export const dynamic = 'force-static'

export default function UnsubscribedPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const err = searchParams?.error
  return (
    <main className="min-h-screen bg-[#07090F] text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mb-6">
          <span className="inline-block px-3 py-1 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] font-semibold text-xs tracking-wider">FEEL THE GAP</span>
        </div>
        {err ? (
          <>
            <h1 className="text-2xl font-bold mb-3">Lien invalide ou expiré</h1>
            <p className="text-gray-400">Merci de contacter outreach@ofaops.xyz pour confirmer ton désabonnement.</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-3">Désabonné</h1>
            <p className="text-gray-400">Tu ne recevras plus d’emails de cette séquence. Tu peux toujours te reconnecter à ton compte.</p>
          </>
        )}
        <a href="/" className="inline-block mt-8 text-[#C9A84C] hover:underline">Retour au site</a>
      </div>
    </main>
  )
}
