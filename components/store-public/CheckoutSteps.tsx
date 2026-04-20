// © 2025-2026 Feel The Gap — checkout multi-step indicator (server-safe)

interface Props {
  current: number
  steps?: string[]
}

const DEFAULT_STEPS = ['Compte', 'Adresses', 'Livraison', 'Paiement', 'Confirmation']

export function CheckoutSteps({ current, steps = DEFAULT_STEPS }: Props) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((label, i) => {
        const reached = i <= current
        const active = i === current
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                active
                  ? 'bg-[#C9A84C] text-[#07090F]'
                  : reached
                    ? 'bg-emerald-500 text-[#07090F]'
                    : 'bg-white/10 text-gray-500'
              }`}
            >
              {reached && !active ? '✓' : i + 1}
            </span>
            <span
              className={
                active
                  ? 'font-semibold text-white'
                  : reached
                    ? 'text-emerald-400'
                    : 'text-gray-500'
              }
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className="text-gray-600">›</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
