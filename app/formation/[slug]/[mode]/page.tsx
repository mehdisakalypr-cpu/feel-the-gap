import { notFound, redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import TutorialPlayer from './TutorialPlayer'

export const dynamic = 'force-dynamic'

export default async function TutorialModePage({ params }: { params: Promise<{ slug: string; mode: string }> }) {
  const { slug, mode } = await params
  if (mode !== 'terrain' && mode !== 'serre') notFound()

  const sb = await createSupabaseServer()
  const { data: t } = await sb.from('crop_tutorials').select('id, slug, crop_name_fr, crop_name').eq('slug', slug).maybeSingle()
  if (!t) notFound()

  const { data: m } = await sb
    .from('crop_tutorial_modes')
    .select('id, mode, yield_kg_ha, cost_eur_ha, roi_pct, description_md')
    .eq('tutorial_id', t.id).eq('mode', mode).maybeSingle()
  if (!m) notFound()

  const { data: steps } = await sb
    .from('crop_tutorial_steps')
    .select('id, step_order, title, text_md, video_url, tts_audio_url, image_url, duration_minutes')
    .eq('mode_id', m.id).order('step_order')

  const { data: quizzes } = await sb
    .from('crop_tutorial_quizzes')
    .select('id, question, choices, correct_idx, explanation, display_order')
    .eq('mode_id', m.id).order('display_order')

  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect(`/auth/login?next=/formation/${slug}/${mode}`)

  const { data: progress } = await sb
    .from('crop_tutorial_progress')
    .select('steps_completed, quiz_score_pct, completed_at')
    .eq('user_id', user.id).eq('mode_id', m.id).maybeSingle()

  return (
    <TutorialPlayer
      crop={t.crop_name_fr || t.crop_name}
      cropSlug={t.slug}
      mode={m.mode as 'terrain' | 'serre'}
      modeId={m.id}
      steps={(steps ?? []) as Array<{ id: string; step_order: number; title: string; text_md: string; video_url: string | null; tts_audio_url: string | null; image_url: string | null; duration_minutes: number }>}
      quizzes={(quizzes ?? []) as Array<{ id: string; question: string; choices: string[]; correct_idx: number; explanation: string; display_order: number }>}
      initialProgress={progress ? { steps_completed: progress.steps_completed, quiz_score_pct: progress.quiz_score_pct, completed_at: progress.completed_at } : null}
    />
  )
}
