'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase'

type Step = { id: string; step_order: number; title: string; text_md: string; video_url: string | null; tts_audio_url: string | null; image_url: string | null; duration_minutes: number }
type Quiz = { id: string; question: string; choices: string[]; correct_idx: number; explanation: string; display_order: number }

interface Props {
  crop: string
  cropSlug: string
  mode: 'terrain' | 'serre'
  modeId: string
  steps: Step[]
  quizzes: Quiz[]
  initialProgress: { steps_completed: number; quiz_score_pct: number | null; completed_at: string | null } | null
}

export default function TutorialPlayer({ crop, cropSlug, mode, modeId, steps, quizzes, initialProgress }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<'steps' | 'quiz' | 'done'>(initialProgress?.completed_at ? 'done' : 'steps')
  const [currentStep, setCurrentStep] = useState(Math.min(initialProgress?.steps_completed ?? 0, steps.length - 1))
  const [stepsDone, setStepsDone] = useState(initialProgress?.steps_completed ?? 0)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const sb = createSupabaseBrowser()

  async function saveProgress(stepsCompletedNew: number, quizPct?: number, isDone?: boolean) {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    await sb.from('crop_tutorial_progress').upsert({
      user_id: user.id,
      mode_id: modeId,
      steps_completed: stepsCompletedNew,
      quiz_score_pct: quizPct ?? null,
      completed_at: isDone ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,mode_id' })
  }

  async function markStepDone() {
    const nextDone = Math.max(stepsDone, currentStep + 1)
    setStepsDone(nextDone)
    setSaving(true)
    await saveProgress(nextDone)
    setSaving(false)
    if (currentStep + 1 < steps.length) {
      setCurrentStep(currentStep + 1)
    } else {
      setPhase('quiz')
    }
  }

  async function submitQuiz() {
    const correct = quizzes.filter((q) => quizAnswers[q.id] === q.correct_idx).length
    const pct = Math.round((correct / Math.max(1, quizzes.length)) * 100)
    setQuizSubmitted(true)
    if (pct >= 80) {
      await saveProgress(steps.length, pct, true)
      setTimeout(() => setPhase('done'), 1500)
    } else {
      await saveProgress(steps.length, pct, false)
    }
  }

  const step = steps[currentStep]
  const progressPct = phase === 'done' ? 100 : phase === 'quiz' ? 95 : Math.round((stepsDone / Math.max(1, steps.length)) * 90)

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0E17]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={`/formation/${cropSlug}`} className="text-sm text-gray-500 hover:text-[#C9A84C]">← {crop}</Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span>{mode === 'terrain' ? '🌾 Terrain' : '🏡 Serre'}</span>
              <span>·</span>
              <span>Étape {phase === 'done' ? '✓' : phase === 'quiz' ? 'Quiz' : `${currentStep + 1}/${steps.length}`}</span>
              <span className="ml-auto font-semibold text-[#C9A84C]">{progressPct}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-[#C9A84C] transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {phase === 'steps' && step && (
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Étape {step.step_order}/{steps.length} · {step.duration_minutes} min</div>
            <h1 className="text-3xl font-bold mb-6">{step.title}</h1>

            {step.image_url && (
              <img src={step.image_url} alt="" className="w-full rounded-xl mb-6" />
            )}
            {step.video_url && (
              <div className="aspect-video rounded-xl overflow-hidden mb-6 bg-black">
                <iframe src={step.video_url} className="w-full h-full" allowFullScreen title={step.title} />
              </div>
            )}

            <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap leading-relaxed">
              {step.text_md}
            </div>

            {step.tts_audio_url && (
              <audio src={step.tts_audio_url} controls className="w-full mt-6" preload="none" />
            )}

            <div className="flex items-center gap-3 mt-10">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >← Précédent</button>
              )}
              <button
                onClick={markStepDone}
                disabled={saving}
                className="ml-auto px-6 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] disabled:opacity-50"
              >
                {saving ? '...' : currentStep + 1 < steps.length ? 'Étape suivante →' : 'Passer au quiz →'}
              </button>
            </div>
          </div>
        )}

        {phase === 'quiz' && (
          <div>
            <div className="text-xs uppercase tracking-wider text-[#C9A84C] mb-2">Quiz final · 80% requis</div>
            <h1 className="text-3xl font-bold mb-6">Valide ta compréhension</h1>

            <div className="space-y-6">
              {quizzes.map((q, qi) => (
                <div key={q.id} className="bg-[#0D1117] border border-white/10 rounded-xl p-5">
                  <div className="text-xs text-gray-500 mb-2">Question {qi + 1}</div>
                  <p className="font-semibold mb-4">{q.question}</p>
                  <div className="space-y-2">
                    {q.choices.map((c, i) => {
                      const chosen = quizAnswers[q.id] === i
                      const correct = quizSubmitted && i === q.correct_idx
                      const wrong = quizSubmitted && chosen && i !== q.correct_idx
                      return (
                        <button
                          key={i}
                          disabled={quizSubmitted}
                          onClick={() => setQuizAnswers({ ...quizAnswers, [q.id]: i })}
                          className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${chosen && !quizSubmitted ? 'border-[#C9A84C] bg-[#C9A84C]/10' : correct ? 'border-emerald-400 bg-emerald-400/10' : wrong ? 'border-red-400 bg-red-400/10' : 'border-white/10 hover:border-white/30'}`}
                        >
                          {c}
                          {correct && <span className="ml-2 text-emerald-400">✓</span>}
                          {wrong && <span className="ml-2 text-red-400">✗</span>}
                        </button>
                      )
                    })}
                  </div>
                  {quizSubmitted && q.explanation && (
                    <div className="mt-3 text-xs text-gray-500 italic">💡 {q.explanation}</div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={submitQuiz}
              disabled={quizSubmitted || Object.keys(quizAnswers).length < quizzes.length}
              className="w-full mt-8 px-6 py-3 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] disabled:opacity-40"
            >
              {quizSubmitted ? 'Vérification...' : 'Valider le quiz'}
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-4xl font-bold mb-3">Tutoriel complété</h1>
            <p className="text-gray-400 mb-8">Tu as débloqué les acheteurs potentiels de <strong className="text-white">{crop}</strong> ({mode}).</p>
            <button
              onClick={() => router.push(`/leads/${cropSlug}`)}
              className="px-8 py-3 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A]"
            >
              Voir les acheteurs potentiels →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
