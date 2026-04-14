/**
 * /admin/videos — preview des compositions Remotion via @remotion/player.
 * Rendu côté client (le Player Remotion ne fonctionne qu en CSR).
 */
'use client'

import dynamic from 'next/dynamic'

const VideoPlayer = dynamic(() => import('./VideoPlayer'), { ssr: false })

export default function VideosPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto text-white">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#C9A84C]">Vidéos concept FTG</h1>
        <p className="text-xs text-gray-500 mt-1">
          Compositions Remotion. Rendu local via{' '}
          <code className="text-[#C9A84C]">npm run video:render</code>.
        </p>
      </header>
      <VideoPlayer />
    </div>
  )
}
