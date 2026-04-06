'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ── Types ────────────────────────────────────────────────────────────────────

type CmsPage = {
  id: string
  slug: string
  title: string
  sections: Section[]
  published: boolean
  updated_at: string
}

type Section = {
  id: string
  type: 'hero' | 'text' | 'video' | 'feature'
  title?: string
  body?: string
  video_url?: string
  video_type?: 'youtube' | 'vimeo' | 'native'
}

type CmsMedia = {
  id: string
  type: 'video_url' | 'video_upload' | 'image'
  url: string
  title: string
  thumbnail?: string
  created_at: string
}

// ── Video embed helper ────────────────────────────────────────────────────────

function getEmbedUrl(url: string): { type: 'youtube' | 'vimeo' | 'native', embed: string } | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return { type: 'youtube', embed: `https://www.youtube.com/embed/${yt[1]}` }
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return { type: 'vimeo', embed: `https://player.vimeo.com/video/${vm[1]}` }
  if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) return { type: 'native', embed: url }
  return null
}

function VideoPlayer({ url }: { url: string }) {
  const info = getEmbedUrl(url)
  if (!info) return <p className="text-xs text-gray-500">Invalid video URL</p>
  if (info.type === 'native') {
    return (
      <video src={info.embed} controls className="w-full rounded-lg aspect-video bg-black" />
    )
  }
  return (
    <iframe
      src={info.embed}
      className="w-full rounded-lg aspect-video"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function CMSPage() {
  const [pages, setPages] = useState<CmsPage[]>([])
  const [media, setMedia] = useState<CmsMedia[]>([])
  const [activeTab, setActiveTab] = useState<'pages' | 'media'>('pages')
  const [editingPage, setEditingPage] = useState<CmsPage | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Media form
  const [newMediaUrl, setNewMediaUrl] = useState('')
  const [newMediaTitle, setNewMediaTitle] = useState('')
  const [newMediaType, setNewMediaType] = useState<'video_url' | 'image'>('video_url')

  useEffect(() => {
    loadPages()
    loadMedia()
  }, [])

  async function loadPages() {
    const { data } = await supabase.from('cms_pages').select('*').order('slug')
    setPages((data as any) ?? [])
  }

  async function loadMedia() {
    const { data } = await supabase.from('cms_media').select('*').order('created_at', { ascending: false })
    setMedia((data as any) ?? [])
  }

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function savePage(page: CmsPage) {
    setSaving(true)
    await supabase.from('cms_pages').upsert({ ...page, updated_at: new Date().toISOString() })
    await loadPages()
    setSaving(false)
    show('Saved!')
  }

  async function togglePublish(page: CmsPage) {
    await supabase.from('cms_pages').update({ published: !page.published }).eq('id', page.id)
    await loadPages()
  }

  async function addMedia() {
    if (!newMediaUrl || !newMediaTitle) return
    await supabase.from('cms_media').insert({
      type: newMediaType,
      url: newMediaUrl,
      title: newMediaTitle,
    })
    setNewMediaUrl('')
    setNewMediaTitle('')
    await loadMedia()
    show('Media added!')
  }

  async function deleteMedia(id: string) {
    await supabase.from('cms_media').delete().eq('id', id)
    await loadMedia()
  }

  function updateSection(page: CmsPage, secId: string, patch: Partial<Section>): CmsPage {
    return {
      ...page,
      sections: page.sections.map(s => s.id === secId ? { ...s, ...patch } : s),
    }
  }

  function addSection(page: CmsPage, type: Section['type']): CmsPage {
    const sec: Section = { id: crypto.randomUUID(), type }
    return { ...page, sections: [...(page.sections ?? []), sec] }
  }

  function removeSection(page: CmsPage, secId: string): CmsPage {
    return { ...page, sections: page.sections.filter(s => s.id !== secId) }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#22C55E] text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">CMS</h1>
        <p className="text-sm text-gray-500 mt-1">Edit page content · manage media</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['pages', 'media'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2 text-xs font-semibold rounded-lg transition-colors capitalize"
            style={{
              background: activeTab === tab ? '#C9A84C22' : 'transparent',
              color: activeTab === tab ? '#C9A84C' : '#6B7280',
              border: `1px solid ${activeTab === tab ? '#C9A84C44' : '#374151'}`,
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Pages tab */}
      {activeTab === 'pages' && !editingPage && (
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Pages</h2>
          {pages.length === 0 ? (
            <p className="text-xs text-gray-500">No CMS pages yet. Run the SQL migration to seed defaults.</p>
          ) : (
            <div className="space-y-2">
              {pages.map(page => (
                <div key={page.id}
                  className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-white font-medium">{page.title}</p>
                    <p className="text-xs text-gray-500">/{page.slug} · {(page.sections ?? []).length} sections</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => togglePublish(page)}
                      className="text-[10px] px-2 py-1 rounded-full font-semibold"
                      style={{
                        color: page.published ? '#22C55E' : '#6B7280',
                        background: page.published ? '#22C55E22' : '#6B728022',
                      }}>
                      {page.published ? 'published' : 'draft'}
                    </button>
                    <button onClick={() => setEditingPage(page)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,.3)] text-[#C9A84C] hover:bg-[#C9A84C11] transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Page editor */}
      {activeTab === 'pages' && editingPage && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setEditingPage(null)}
              className="text-xs text-gray-500 hover:text-white transition-colors">
              ← Back
            </button>
            <h2 className="text-sm font-semibold text-white">{editingPage.title}</h2>
            <button onClick={() => savePage(editingPage)} disabled={saving}
              className="ml-auto px-4 py-2 text-xs font-semibold rounded-lg bg-[#C9A84C] text-black hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {/* Page meta */}
          <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5 space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Page Title</label>
              <input value={editingPage.title} onChange={e => setEditingPage({ ...editingPage, title: e.target.value })}
                className="w-full bg-[#1F2937] text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-[#C9A84C]" />
            </div>
          </div>

          {/* Sections */}
          {(editingPage.sections ?? []).map((sec, i) => (
            <div key={sec.id} className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#C9A84C] uppercase">{sec.type} block</span>
                <button onClick={() => setEditingPage(removeSection(editingPage, sec.id))}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors">✕ Remove</button>
              </div>

              {sec.type !== 'video' && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Title</label>
                    <input value={sec.title ?? ''} onChange={e => setEditingPage(updateSection(editingPage, sec.id, { title: e.target.value }))}
                      className="w-full bg-[#1F2937] text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-[#C9A84C]" />
                  </div>
                  {sec.type !== 'feature' && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Body</label>
                      <textarea value={sec.body ?? ''} rows={4}
                        onChange={e => setEditingPage(updateSection(editingPage, sec.id, { body: e.target.value }))}
                        className="w-full bg-[#1F2937] text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-[#C9A84C] resize-none" />
                    </div>
                  )}
                </>
              )}

              {sec.type === 'video' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Video URL (YouTube, Vimeo, or direct .mp4)</label>
                    <input value={sec.video_url ?? ''} placeholder="https://youtube.com/watch?v=…"
                      onChange={e => setEditingPage(updateSection(editingPage, sec.id, { video_url: e.target.value }))}
                      className="w-full bg-[#1F2937] text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-[#C9A84C]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Caption</label>
                    <input value={sec.title ?? ''} onChange={e => setEditingPage(updateSection(editingPage, sec.id, { title: e.target.value }))}
                      className="w-full bg-[#1F2937] text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-[#C9A84C]" />
                  </div>
                  {sec.video_url && (
                    <div>
                      <label className="text-xs text-gray-500 mb-2 block">Preview</label>
                      <VideoPlayer url={sec.video_url} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add section */}
          <div className="bg-[#0D1117] border border-dashed border-[rgba(201,168,76,.2)] rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-3">Add a new block</p>
            <div className="flex flex-wrap gap-2">
              {(['hero', 'text', 'video', 'feature'] as Section['type'][]).map(type => (
                <button key={type} onClick={() => setEditingPage(addSection(editingPage, type))}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(201,168,76,.3)] text-[#C9A84C] hover:bg-[#C9A84C11] transition-colors capitalize">
                  + {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Media tab */}
      {activeTab === 'media' && (
        <div className="space-y-4">
          {/* Add media form */}
          <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Add Media</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type</label>
                <select value={newMediaType} onChange={e => setNewMediaType(e.target.value as any)}
                  className="w-full bg-[#1F2937] text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-[#C9A84C]">
                  <option value="video_url">Video URL</option>
                  <option value="image">Image URL</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">URL</label>
                <input value={newMediaUrl} onChange={e => setNewMediaUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full bg-[#1F2937] text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Title</label>
                <input value={newMediaTitle} onChange={e => setNewMediaTitle(e.target.value)}
                  placeholder="Demo overview…"
                  className="w-full bg-[#1F2937] text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-[#C9A84C]" />
              </div>
            </div>
            <button onClick={addMedia}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#C9A84C] text-black hover:opacity-90 transition-opacity">
              Add
            </button>
          </div>

          {/* Media grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {media.length === 0 ? (
              <p className="text-xs text-gray-500 col-span-3">No media yet.</p>
            ) : media.map(m => (
              <div key={m.id} className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl overflow-hidden">
                {m.type === 'video_url' && (
                  <div className="aspect-video">
                    <VideoPlayer url={m.url} />
                  </div>
                )}
                {m.type === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.title} className="w-full aspect-video object-cover" />
                )}
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white font-medium">{m.title}</p>
                    <p className="text-[10px] text-gray-500">{new Date(m.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => deleteMedia(m.id)}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors ml-2">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
