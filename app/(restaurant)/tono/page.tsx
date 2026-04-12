'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Check, Play, Loader2, RefreshCw, Volume2, Star, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type TonePreset = 'amigable' | 'formal' | 'entusiasta' | 'minimalista'

interface ToneConfig {
  preset: TonePreset
  greeting: string
  recommendations: string
  farewell: string
  useEmojis: boolean
  responseLength: 'corta' | 'media' | 'larga'
  language: 'chileno' | 'neutro' | 'formal'
}

interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  tags: string[]
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS: { id: TonePreset; label: string; desc: string; emoji: string; example: string }[] = [
  {
    id: 'amigable',
    label: 'Amigable',
    emoji: '😊',
    desc: 'Como el mozo de confianza del barrio. Cercano, cálido, usa chilenismos.',
    example: '¡Hola! Bienvenido al Rincón 🍽️ ¿Qué se te antoja hoy? Te puedo recomendar el lomo vetado que está espectacular.',
  },
  {
    id: 'formal',
    label: 'Formal',
    emoji: '🎩',
    desc: 'Elegante y profesional. Ideal para restaurantes de alta cocina.',
    example: 'Buenas noches, bienvenido a El Rincón. Es un placer atenderle. ¿Desea que le presente nuestra carta de esta noche?',
  },
  {
    id: 'entusiasta',
    label: 'Entusiasta',
    emoji: '🔥',
    desc: 'Energético y apasionado. Hace que cada plato suene increíble.',
    example: '¡Hola hola! 🔥 ¡Llegaste al lugar indicado! Hoy el lomo vetado está INCREÍBLE, y el tiramisú... no te lo puedes perder.',
  },
  {
    id: 'minimalista',
    label: 'Minimalista',
    emoji: '◻️',
    desc: 'Directo y conciso. Solo lo necesario, sin adornos.',
    example: 'Bienvenido. ¿Qué le traigo? Recomiendo el lomo vetado o el salmón. ¿Alguna restricción alimentaria?',
  },
]

const LANGUAGE_OPTIONS = [
  { id: 'chileno', label: 'Chileno', desc: 'Usa modismos: "bacán", "al tiro", "Lucas"' },
  { id: 'neutro',  label: 'Neutro',  desc: 'Español estándar, entendible para todos' },
  { id: 'formal',  label: 'Formal',  desc: 'Usted, sin contracciones, preciso' },
]

// ── Preview simulator ─────────────────────────────────────────────────────────

const PREVIEW_SCENARIOS = [
  { user: '¿Qué me recomiendas?', key: 'recommendations' },
  { user: 'La cuenta, por favor', key: 'farewell' },
  { user: 'Quiero pedir', key: 'greeting' },
]

export default function TonoPage() {
  const [config, setConfig] = useState<ToneConfig>({
    preset: 'amigable',
    greeting: 'Hola, bienvenido a El Rincón 🍽️ ¿Qué se te antoja hoy?',
    recommendations: 'Te recomiendo el lomo vetado, es el favorito de la casa. ¿Tienes alguna restricción alimentaria?',
    farewell: '¡Gracias por visitarnos! Espero que todo haya estado perfecto. ¡Hasta pronto! 🙌',
    useEmojis: true,
    responseLength: 'media',
    language: 'chileno',
  })

  const [menuItems, setMenuItems]       = useState<MenuItem[]>([])
  const [featuredIds, setFeaturedIds]   = useState<string[]>([])
  const [savingFeatures, setSavingFeatures] = useState(false)
  const [featuresSaved, setFeaturesSaved]   = useState(false)

  const [testInput, setTestInput]   = useState('')
  const [testOutput, setTestOutput] = useState('')
  const [testing, setTesting]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [activeScenario, setActiveScenario] = useState(0)

  // Load menu items + current featured selection
  useEffect(() => {
    fetch('/api/menu-features')
      .then(r => r.json())
      .then(({ items }) => {
        if (!items) return
        setMenuItems(items)
        setFeaturedIds(items.filter((i: MenuItem) => i.tags?.includes('promovido')).map((i: MenuItem) => i.id))
      })
      .catch(() => null)
  }, [])

  async function saveFeatures() {
    setSavingFeatures(true)
    await fetch('/api/menu-features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: featuredIds }),
    })
    setSavingFeatures(false)
    setFeaturesSaved(true)
    setTimeout(() => setFeaturesSaved(false), 2500)
  }

  function toggleFeatured(id: string) {
    setFeaturedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    setFeaturesSaved(false)
  }

  function applyPreset(preset: TonePreset) {
    const p = PRESETS.find(p => p.id === preset)!
    setConfig(prev => ({
      ...prev,
      preset,
      greeting: p.id === 'amigable'    ? 'Hola, bienvenido a El Rincón 🍽️ ¿Qué se te antoja hoy?'
               : p.id === 'formal'     ? 'Buenas noches, bienvenido. ¿Desea ver nuestra carta?'
               : p.id === 'entusiasta' ? '¡Hola hola! 🔥 ¡Llegaste al lugar indicado! ¿Qué te traemos?'
               : 'Bienvenido. ¿Qué le traigo?',
    }))
  }

  async function handleTest() {
    if (!testInput.trim()) return
    setTesting(true)
    setTestOutput('')
    // Simulate Chapi response with current tone config
    await new Promise(r => setTimeout(r, 1200))
    const responses: Record<string, string> = {
      amigable:    `¡Claro! Para algo rico y al tiro, te recomiendo el lomo vetado — está espectacular hoy. Viene con papas fritas y ensalada por $15.9k. ¿Te lo anoto? 😋`,
      formal:      `Con mucho gusto. Le recomiendo el lomo vetado, es el plato más solicitado de nuestra carta. Lo acompaña una ensalada fresca y papas. Precio: $15.900.`,
      entusiasta:  `¡OYE! 🔥 El lomo vetado hoy está EN OTRO NIVEL. Viene con papas crujientes y ensalada — a $15.9k es un REGALO. ¡No lo pienses más!`,
      minimalista: `Lomo vetado. $15.9k. Con papas y ensalada. ¿Lo agrego?`,
    }
    setTestOutput(responses[config.preset] || responses.amigable)
    setTesting(false)
  }

  async function handleSave() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 700))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const activePreset = PRESETS.find(p => p.id === config.preset)!

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Tono de Chapi</h1>
          <p className="text-white/40 text-sm mt-0.5">Personaliza cómo Chapi habla con tus clientes</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-60 transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Sparkles size={14} />}
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar tono'}
        </button>
      </div>

      {/* Preset selector */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <p className="text-white font-semibold text-sm">Personalidad base</p>
        <div className="grid grid-cols-2 gap-3">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
              className={`p-4 rounded-xl border text-left transition-all
                ${config.preset === p.id
                  ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40'
                  : 'bg-white/3 border-white/8 hover:border-white/15'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{p.emoji}</span>
                <p className={`font-semibold text-sm ${config.preset === p.id ? 'text-[#FF6B35]' : 'text-white/70'}`}>
                  {p.label}
                </p>
                {config.preset === p.id && <Check size={12} className="text-[#FF6B35] ml-auto" />}
              </div>
              <p className="text-white/35 text-xs leading-relaxed">{p.desc}</p>
            </button>
          ))}
        </div>
        {/* Example */}
        <div className="bg-white/3 border border-white/6 rounded-xl p-3.5">
          <p className="text-white/25 text-[10px] mb-2 font-medium uppercase tracking-wide">Ejemplo con este tono:</p>
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-[#FF6B35] flex items-center justify-center text-white text-[9px] font-bold shrink-0">C</div>
            <p className="text-white/60 text-sm italic leading-relaxed">"{activePreset.example}"</p>
          </div>
        </div>
      </div>

      {/* Fine-tuning */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <p className="text-white font-semibold text-sm">Ajustes finos</p>

        <div className="grid grid-cols-3 gap-3">
          {/* Emojis */}
          <div className="space-y-2">
            <p className="text-white/40 text-xs">Emojis</p>
            <button onClick={() => setConfig(c => ({ ...c, useEmojis: !c.useEmojis }))}
              className={`w-full py-2.5 rounded-xl border text-xs font-medium transition-all
                ${config.useEmojis ? 'bg-[#FF6B35]/15 border-[#FF6B35]/30 text-[#FF6B35]' : 'bg-white/3 border-white/8 text-white/30'}`}>
              {config.useEmojis ? '😊 Activados' : '— Desactivados'}
            </button>
          </div>
          {/* Response length */}
          <div className="space-y-2">
            <p className="text-white/40 text-xs">Largo respuesta</p>
            <div className="flex gap-1">
              {(['corta', 'media', 'larga'] as const).map(l => (
                <button key={l} onClick={() => setConfig(c => ({ ...c, responseLength: l }))}
                  className={`flex-1 py-2.5 rounded-xl border text-[10px] capitalize transition-all
                    ${config.responseLength === l ? 'bg-[#FF6B35]/15 border-[#FF6B35]/30 text-[#FF6B35]' : 'bg-white/3 border-white/8 text-white/25'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {/* Language */}
          <div className="space-y-2">
            <p className="text-white/40 text-xs">Variante idioma</p>
            <div className="flex gap-1">
              {LANGUAGE_OPTIONS.map(l => (
                <button key={l.id} onClick={() => setConfig(c => ({ ...c, language: l.id as ToneConfig['language'] }))}
                  className={`flex-1 py-2.5 rounded-xl border text-[10px] transition-all
                    ${config.language === l.id ? 'bg-[#FF6B35]/15 border-[#FF6B35]/30 text-[#FF6B35]' : 'bg-white/3 border-white/8 text-white/25'}`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom phrases */}
        <div className="space-y-3">
          <p className="text-white/40 text-xs font-medium">Frases personalizadas</p>
          {[
            { key: 'greeting',        label: 'Saludo inicial' },
            { key: 'recommendations', label: 'Al recomendar' },
            { key: 'farewell',        label: 'Despedida / cuenta' },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-white/30 text-[10px]">{label}</label>
              <textarea
                value={config[key as keyof ToneConfig] as string}
                onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-xs placeholder:text-white/15 focus:outline-none focus:border-[#FF6B35]/40 resize-none transition-colors"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Cross-selling — platos destacados */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Star size={14} className="text-[#FBBF24]" />
              <p className="text-white font-semibold text-sm">Platos a destacar</p>
            </div>
            <p className="text-white/35 text-xs mt-0.5">
              Chapi recomendará estos platos activamente a cada mesa. Máximo 3.
            </p>
          </div>
          <button
            onClick={saveFeatures}
            disabled={savingFeatures}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#e85d2a] disabled:opacity-40 transition-colors"
          >
            {savingFeatures ? <Loader2 size={12} className="animate-spin" /> : featuresSaved ? <Check size={12} /> : <Star size={12} />}
            {featuresSaved ? 'Guardado' : 'Guardar'}
          </button>
        </div>

        {menuItems.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-white/25">
            <Loader2 size={14} className="animate-spin" />
            <p className="text-xs">Cargando carta…</p>
          </div>
        ) : (
          <>
            {/* Selected chips */}
            {featuredIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {featuredIds.map(id => {
                  const item = menuItems.find(m => m.id === id)
                  if (!item) return null
                  return (
                    <span key={id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FBBF24]/20 border border-[#FBBF24]/40 text-[#FBBF24]">
                      ⭐ {item.name}
                      <button onClick={() => toggleFeatured(id)} className="hover:text-white transition-colors ml-0.5">
                        <X size={10} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            {/* Group by category */}
            {Object.entries(
              menuItems.reduce((acc, item) => {
                const cat = item.category || 'otros'
                if (!acc[cat]) acc[cat] = []
                acc[cat].push(item)
                return acc
              }, {} as Record<string, MenuItem[]>)
            ).map(([cat, items]) => (
              <div key={cat} className="space-y-1.5">
                <p className="text-white/25 text-[10px] uppercase tracking-widest font-semibold">{cat}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map(item => {
                    const isFeatured = featuredIds.includes(item.id)
                    const atLimit = featuredIds.length >= 3 && !isFeatured
                    return (
                      <button
                        key={item.id}
                        onClick={() => !atLimit && toggleFeatured(item.id)}
                        disabled={atLimit}
                        className={`px-3 py-1.5 rounded-xl border text-xs transition-all
                          ${isFeatured
                            ? 'bg-[#FBBF24]/15 border-[#FBBF24]/40 text-[#FBBF24] font-semibold'
                            : atLimit
                              ? 'bg-white/2 border-white/5 text-white/15 cursor-not-allowed'
                              : 'bg-white/4 border-white/8 text-white/50 hover:border-white/20 hover:text-white/70'
                          }`}
                      >
                        {isFeatured && '⭐ '}{item.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {featuredIds.length >= 3 && (
              <p className="text-white/30 text-[10px]">Máximo 3 platos seleccionados. Quita uno para agregar otro.</p>
            )}
          </>
        )}
      </div>

      {/* Test sandbox */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-[#FF6B35]" />
          <p className="text-white font-semibold text-sm">Probar el tono</p>
        </div>

        {/* Scenario chips */}
        <div className="flex gap-2 flex-wrap">
          {PREVIEW_SCENARIOS.map((s, i) => (
            <button key={i} onClick={() => { setActiveScenario(i); setTestInput(s.user); setTestOutput('') }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all
                ${activeScenario === i && testInput === s.user ? 'bg-[#FF6B35]/15 border-[#FF6B35]/30 text-[#FF6B35]' : 'bg-white/3 border-white/8 text-white/35 hover:border-white/20'}`}>
              "{s.user}"
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input value={testInput} onChange={e => setTestInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTest()}
            placeholder='Escribe un mensaje de cliente...'
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
          <button onClick={handleTest} disabled={testing || !testInput.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#FF6B35] text-white disabled:opacity-40 hover:bg-[#e85d2a] transition-colors flex items-center gap-1.5 text-sm font-medium">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Probar
          </button>
        </div>

        {testOutput && (
          <div className="flex gap-2.5 bg-white/3 border border-white/6 rounded-xl p-4">
            <div className="w-6 h-6 rounded-full bg-[#FF6B35] flex items-center justify-center text-white text-[9px] font-bold shrink-0">C</div>
            <div>
              <p className="text-white/25 text-[9px] mb-1.5 font-medium">CHAPI RESPONDE:</p>
              <p className="text-white/75 text-sm leading-relaxed">{testOutput}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
