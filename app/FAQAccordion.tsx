'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

export function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div
            key={i}
            className={`rounded-2xl border transition-all duration-200 ${
              isOpen
                ? 'border-[#FF6B35]/20 bg-white shadow-sm'
                : 'border-neutral-100 bg-white hover:border-neutral-200'
            }`}
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="text-sm font-semibold text-[#1A1A2E]">
                {item.question}
              </span>
              <ChevronDown
                size={18}
                className={`text-neutral-400 shrink-0 transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-[#FF6B35]' : ''
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <p className="px-6 pb-5 text-sm text-neutral-500 leading-relaxed">
                {item.answer}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
