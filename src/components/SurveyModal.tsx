'use client'

import { useState, useEffect } from 'react'

interface SurveyModalProps {
  surveyKey: string
  title: string
  subtitle?: string
  options: string[]
  delayMs?: number
}

export default function SurveyModal({
  surveyKey,
  title,
  subtitle,
  options,
  delayMs = 3000,
}: SurveyModalProps) {
  const [show, setShow] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const storageKey = `survey_shown_${surveyKey}`
    const lastShown = localStorage.getItem(storageKey)
    const shouldShow = !lastShown || (Date.now() - parseInt(lastShown)) > 7 * 86400000

    if (!shouldShow) return
    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [surveyKey, delayMs])

  const dismiss = () => {
    localStorage.setItem(`survey_shown_${surveyKey}`, Date.now().toString())
    setShow(false)
  }

  const submit = () => {
    localStorage.setItem(`survey_shown_${surveyKey}`, Date.now().toString())
    setSubmitted(true)
    setTimeout(() => setShow(false), 2000)
  }

  const toggle = (opt: string) => {
    setSelected(prev =>
      prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
    )
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-[#0d0d0d] border border-[#222] rounded-2xl p-6 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-[#b8b8b8] hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <div className="text-primary text-3xl mb-3">✓</div>
            <p className="text-white font-semibold">Thanks for the feedback!</p>
            <p className="text-[#555] text-sm mt-1">It genuinely helps improve the app.</p>
          </div>
        ) : (
          <>
            <h3 className="text-white font-semibold text-[15px] leading-snug pr-6">{title}</h3>
            {subtitle && <p className="text-[#555] text-sm mt-1.5">{subtitle}</p>}

            <div className="mt-4 space-y-2">
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all border ${
                    selected.includes(opt)
                      ? 'border-primary bg-[#001a0d] text-white'
                      : 'border-[#1a1a1a] bg-[#111] text-[#999] hover:border-[#2a2a2a] hover:text-white'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                      selected.includes(opt) ? 'bg-primary border-primary' : 'border-[#888888]'
                    }`}
                  >
                    {selected.includes(opt) && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  {opt}
                </button>
              ))}
            </div>

            <button
              onClick={submit}
              disabled={selected.length === 0}
              className="mt-4 w-full py-3 bg-primary text-black text-sm font-bold tracking-widest rounded-xl hover:bg-[#00CC33] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
            >
              SEND FEEDBACK
            </button>
          </>
        )}
      </div>
    </div>
  )
}
