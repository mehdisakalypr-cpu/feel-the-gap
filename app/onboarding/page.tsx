'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { track } from '@/lib/tracking'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const SECTORS = [
  { value: 'agriculture',    label: '🌾 Agriculture', },
  { value: 'energy',         label: '⚡ Energy', },
  { value: 'manufacturing',  label: '🏭 Manufacturing', },
  { value: 'technology',     label: '💻 Technology', },
  { value: 'construction',   label: '🏗️ Construction', },
  { value: 'food',           label: '🍽️ Food & Beverage', },
  { value: 'pharma',         label: '💊 Pharma / Health', },
  { value: 'textiles',       label: '👕 Textiles', },
]

const REGIONS = [
  'Africa', 'Asia Pacific', 'Europe', 'Latin America',
  'Middle East', 'North America', 'South Asia', 'Global',
]

type Step = 'role' | 'focus' | 'profile' | 'ready'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('role')
  const [form, setForm] = useState({
    role: '',
    company: '',
    sectors: [] as string[],
    regions: [] as string[],
    email: '',
    firstName: '',
  })
  const [saving, setSaving] = useState(false)

  function toggleArr(key: 'sectors' | 'regions', val: string) {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val],
    }))
  }

  async function finish() {
    setSaving(true)
    track('onboarding_complete', { role: form.role, sectors: form.sectors, regions: form.regions })

    // Optionally save profile if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        first_name: form.firstName,
        company: form.company,
        sectors: form.sectors,
        regions: form.regions,
      })
    }

    router.push('/demo')
  }

  const ROLES = [
    { value: 'importer',    label: '🚢 Importer / Trader',      desc: 'I source products from abroad' },
    { value: 'exporter',    label: '📦 Exporter / Producer',     desc: 'I sell products internationally' },
    { value: 'investor',    label: '💼 Investor / VC',           desc: 'I fund cross-border ventures' },
    { value: 'consultant',  label: '🧠 Consultant / Advisor',    desc: 'I advise on market entry' },
    { value: 'other',       label: '🌐 Other',                   desc: 'Something else' },
  ]

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#C9A84C] flex items-center justify-center text-sm font-bold text-black">G</div>
            <span className="text-white font-bold text-lg">Feel The Gap</span>
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            {(['role', 'focus', 'profile', 'ready'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  step === s ? 'bg-[#C9A84C]' :
                  ['role','focus','profile','ready'].indexOf(step) > i ? 'bg-[#22C55E]' : 'bg-[#374151]'
                }`} />
              </div>
            ))}
          </div>
        </div>

        {/* Step: Role */}
        {step === 'role' && (
          <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-2xl p-6">
            <h1 className="text-xl font-bold text-white mb-1">What best describes you?</h1>
            <p className="text-sm text-gray-500 mb-5">We'll personalise your experience</p>
            <div className="space-y-2">
              {ROLES.map(r => (
                <button key={r.value} onClick={() => setForm(f => ({ ...f, role: r.value }))}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors"
                  style={{
                    borderColor: form.role === r.value ? '#C9A84C' : 'rgba(255,255,255,.07)',
                    background: form.role === r.value ? 'rgba(201,168,76,.08)' : 'transparent',
                  }}>
                  <span className="text-xl">{r.label.split(' ')[0]}</span>
                  <div>
                    <p className="text-sm text-white font-medium">{r.label.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs text-gray-500">{r.desc}</p>
                  </div>
                  {form.role === r.value && <span className="ml-auto text-[#C9A84C]">✓</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setStep('focus')} disabled={!form.role}
              className="mt-5 w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-30"
              style={{ background: '#C9A84C', color: '#000' }}>
              Continue →
            </button>
          </div>
        )}

        {/* Step: Focus */}
        {step === 'focus' && (
          <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-2xl p-6">
            <h1 className="text-xl font-bold text-white mb-1">Your areas of focus</h1>
            <p className="text-sm text-gray-500 mb-5">Select all that apply — you can change this later</p>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Sectors</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {SECTORS.map(s => (
                  <button key={s.value} onClick={() => toggleArr('sectors', s.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: form.sectors.includes(s.value) ? '#C9A84C22' : '#1F2937',
                      color: form.sectors.includes(s.value) ? '#C9A84C' : '#9CA3AF',
                      border: `1px solid ${form.sectors.includes(s.value) ? '#C9A84C44' : 'transparent'}`,
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Regions</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {REGIONS.map(r => (
                  <button key={r} onClick={() => toggleArr('regions', r)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: form.regions.includes(r) ? '#60A5FA22' : '#1F2937',
                      color: form.regions.includes(r) ? '#60A5FA' : '#9CA3AF',
                      border: `1px solid ${form.regions.includes(r) ? '#60A5FA44' : 'transparent'}`,
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('role')}
                className="px-4 py-3 rounded-xl text-sm text-gray-500 hover:text-white border border-white/10 transition-colors">
                ← Back
              </button>
              <button onClick={() => setStep('profile')}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity"
                style={{ background: '#C9A84C', color: '#000' }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Profile */}
        {step === 'profile' && (
          <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-2xl p-6">
            <h1 className="text-xl font-bold text-white mb-1">Almost there</h1>
            <p className="text-sm text-gray-500 mb-5">Optional — helps us tailor recommendations</p>
            <div className="space-y-3">
              {[
                { key: 'firstName', label: 'First name', placeholder: 'Alex' },
                { key: 'company',   label: 'Company',    placeholder: 'Acme Trading Ltd.' },
                { key: 'email',     label: 'Email',      placeholder: 'alex@acme.com' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-[#1F2937] text-white text-sm px-3 py-2.5 rounded-lg border border-white/10 outline-none focus:border-[#C9A84C] placeholder-gray-600" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setStep('focus')}
                className="px-4 py-3 rounded-xl text-sm text-gray-500 hover:text-white border border-white/10 transition-colors">
                ← Back
              </button>
              <button onClick={() => setStep('ready')}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: '#C9A84C', color: '#000' }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Ready */}
        {step === 'ready' && (
          <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-2xl p-6 text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h1 className="text-xl font-bold text-white mb-2">You're all set!</h1>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              We'll take you on a quick tour of the platform so you can get the most out of Feel The Gap.
            </p>
            <button onClick={finish} disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: '#C9A84C', color: '#000' }}>
              {saving ? 'Setting up…' : 'Start the tour →'}
            </button>
            <button onClick={() => router.push('/map')}
              className="mt-3 text-xs text-gray-600 hover:text-gray-400 transition-colors w-full">
              Skip — take me straight to the map
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
