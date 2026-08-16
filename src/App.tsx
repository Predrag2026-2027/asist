import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CalendarCheck, Basketball, Receipt, UsersThree, ChartBar, ChartLineUp, ClipboardText, ChatCircleText, FolderSimple, UploadSimple, GearSix, DotsThreeOutline, SignOut } from '@phosphor-icons/react'
import { supabase } from './lib/supabase'
import { T } from './lib/tema'
import DanasScreen from './features/danas/DanasScreen'
import PorodiceScreen from './features/porodice/PorodiceScreen'
import ClanarineScreen from './features/clanarine/ClanarineScreen'
import TreninziScreen from './features/treninzi/TreninziScreen'
import StatistikaScreen from './features/statistika/StatistikaScreen'
import FinansijeScreen from './features/finansije/FinansijeScreen'
import DnevniIzvestajScreen from './features/izvestaj/DnevniIzvestajScreen'
import ObavestenjaScreen from './features/obavestenja/ObavestenjaScreen'
import DokumentiScreen from './features/dokumenti/DokumentiScreen'
import UvozScreen from './features/uvoz/UvozScreen'
import PodesavanjaScreen from './features/podesavanja/PodesavanjaScreen'
import LoginScreen from './features/auth/LoginScreen'

type Tab = 'danas' | 'treninzi' | 'clanarine' | 'porodice' | 'statistika' | 'finansije' | 'izvestaj' | 'obavestenja' | 'dokumenti' | 'uvoz' | 'podesavanja'

const STAVKE: { t: Tab; l: string; Ikona: any }[] = [
  { t: 'danas', l: 'Danas', Ikona: CalendarCheck },
  { t: 'treninzi', l: 'Treninzi', Ikona: Basketball },
  { t: 'clanarine', l: 'Članarine', Ikona: Receipt },
  { t: 'porodice', l: 'Porodice', Ikona: UsersThree },
  { t: 'statistika', l: 'Statistika', Ikona: ChartBar },
  { t: 'finansije', l: 'Finansije', Ikona: ChartLineUp },
  { t: 'izvestaj', l: 'Izveštaj', Ikona: ClipboardText },
  { t: 'obavestenja', l: 'Obaveštenja', Ikona: ChatCircleText },
  { t: 'dokumenti', l: 'Dokumenti', Ikona: FolderSimple },
  { t: 'uvoz', l: 'Uvoz', Ikona: UploadSimple },
  { t: 'podesavanja', l: 'Podešavanja', Ikona: GearSix },
]
const GLAVNE_MOBILNE: Tab[] = ['danas', 'treninzi', 'clanarine', 'porodice']

const ANIM_CSS = `
@keyframes bbArc {
  0%   { transform: translate(-160px, 96px) rotate(0deg) scale(0.7); opacity: 0; }
  12%  { opacity: 1; }
  50%  { transform: translate(-8px, -122px) rotate(380deg) scale(1); opacity: 1; }
  70%  { transform: translate(0px, -4px) rotate(520deg) scale(1); }
  82%  { transform: translate(0px, 46px) rotate(610deg) scale(0.92); }
  100% { transform: translate(0px, 122px) rotate(720deg) scale(0.8); opacity: 0; }
}
@keyframes bbNet {
  0%,60% { transform: scaleY(1); }
  72%    { transform: scaleY(1.32); }
  82%    { transform: scaleY(0.9); }
  92%    { transform: scaleY(1.06); }
  100%   { transform: scaleY(1); }
}
@keyframes bbGlow {
  0% { opacity: 0; } 22% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; }
}
.bbBall { animation: bbArc 0.95s cubic-bezier(0.45,0.05,0.35,1) forwards; }
.bbNet  { transform-box: fill-box; transform-origin: 50% 0%; animation: bbNet 0.95s ease-in-out forwards; }
.bbGlow { animation: bbGlow 0.95s ease forwards; }
@media (prefers-reduced-motion: reduce) { .bbBall, .bbNet, .bbGlow { animation: none !important; opacity: 0 !important; } }
`

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ucitava, setUcitava] = useState(true)
  const [tab, setTab] = useState<Tab>('danas')
  const [vise, setVise] = useState(false)
  const [mobilni, setMobilni] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false)
  const [animKey, setAnimKey] = useState(0)
  const [showAnim, setShowAnim] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setUcitava(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    const rf = () => setMobilni(window.innerWidth < 900)
    window.addEventListener('resize', rf)
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('resize', rf) }
  }, [])

  useEffect(() => {
    if (!showAnim) return
    const id = setTimeout(() => setShowAnim(false), 1000)
    return () => clearTimeout(id)
  }, [showAnim, animKey])

  if (ucitava) return <div style={{ padding: 24, color: T.boja.ink500 }}>Učitavam...</div>
  if (!session) return <LoginScreen />

  function idi(t: Tab) {
    if (t !== tab) { setAnimKey((k) => k + 1); setShowAnim(true) }
    setTab(t)
    setVise(false)
  }

  const ekran = (
    <>
      {tab === 'danas' && <DanasScreen onNavigate={(t) => idi(t as Tab)} />}
      {tab === 'porodice' && <PorodiceScreen />}
      {tab === 'clanarine' && <ClanarineScreen />}
      {tab === 'treninzi' && <TreninziScreen />}
      {tab === 'statistika' && <StatistikaScreen />}
      {tab === 'finansije' && <FinansijeScreen />}
      {tab === 'izvestaj' && <DnevniIzvestajScreen />}
      {tab === 'obavestenja' && <ObavestenjaScreen />}
      {tab === 'dokumenti' && <DokumentiScreen />}
      {tab === 'uvoz' && <UvozScreen />}
      {tab === 'podesavanja' && <PodesavanjaScreen />}
    </>
  )

  const prelaz = showAnim ? (
    <div key={animKey} style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', display: 'grid', placeItems: 'center' }}>
      <div style={{ position: 'relative', width: 360, height: 240 }}>
        <div className="bbGlow" style={{ position: 'absolute', left: 100, top: 30, width: 170, height: 170, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,110,0,0.30), transparent 70%)' }} />
        <svg viewBox="0 0 360 240" width="360" height="240" style={{ position: 'absolute', inset: 0 }}>
          <rect x="120" y="44" width="120" height="62" rx="6" fill="#ffffff" stroke="#d3d8e4" strokeWidth="3" />
          <rect x="162" y="72" width="36" height="26" rx="3" fill="none" stroke="#ff4d00" strokeWidth="3" />
          <g className="bbNet" stroke="rgba(90,95,110,0.55)" strokeWidth="2" fill="none">
            <path d="M132 122 L160 196" />
            <path d="M146 126 L166 196" />
            <path d="M163 128 L172 196" />
            <path d="M180 128 L180 196" />
            <path d="M197 128 L188 196" />
            <path d="M214 126 L194 196" />
            <path d="M228 122 L200 196" />
            <path d="M150 150 Q180 160 210 150" />
            <path d="M156 174 Q180 182 204 174" />
          </g>
          <ellipse cx="180" cy="120" rx="52" ry="13" fill="none" stroke="#ff4d00" strokeWidth="6" />
        </svg>
        <div className="bbBall" style={{ position: 'absolute', left: 160, top: 104, width: 40, height: 40 }}>
          <svg viewBox="0 0 100 100" width="40" height="40">
            <circle cx="50" cy="50" r="46" fill="#ff6a00" stroke="#2f1206" strokeWidth="4" />
            <line x1="50" y1="6" x2="50" y2="94" stroke="#2f1206" strokeWidth="4" />
            <line x1="6" y1="50" x2="94" y2="50" stroke="#2f1206" strokeWidth="4" />
            <path d="M50 6 C22 30 22 70 50 94" fill="none" stroke="#2f1206" strokeWidth="4" />
            <path d="M50 6 C78 30 78 70 50 94" fill="none" stroke="#2f1206" strokeWidth="4" />
          </svg>
        </div>
      </div>
    </div>
  ) : null

  const marka = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 40, height: 40, borderRadius: T.r.brand, background: T.boja.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(255,77,0,0.4)' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.06em' }}>BB</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Asist</span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.boja.ink500 }}>BB Basket</span>
      </div>
    </div>
  )

  if (mobilni) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent' }}>
        <main style={{ paddingBottom: 78 }}>{prelaz}{ekran}</main>
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(180deg, #151d2e 0%, #0e1421 100%)', display: 'flex', borderTop: `1px solid ${T.boja.ink800}`, zIndex: 50, boxShadow: '0 -6px 20px rgba(17,24,39,0.16)' }}>
          {STAVKE.filter((s) => GLAVNE_MOBILNE.includes(s.t)).map((s) => {
            const a = tab === s.t
            return (
              <button key={s.t} onClick={() => idi(s.t)} style={{ flex: 1, border: 'none', background: 'none', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', color: a ? T.boja.brand : T.boja.ink400 }}>
                <s.Ikona size={22} weight={a ? 'fill' : 'regular'} />
                <span style={{ fontSize: 10, fontWeight: 800 }}>{s.l}</span>
              </button>
            )
          })}
          <button onClick={() => setVise(true)} style={{ flex: 1, border: 'none', background: 'none', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', color: T.boja.ink400 }}>
            <DotsThreeOutline size={22} />
            <span style={{ fontSize: 10, fontWeight: 800 }}>Više</span>
          </button>
        </nav>

        {vise && (
          <div onClick={() => setVise(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.4)', zIndex: 60, display: 'flex', alignItems: 'flex-end' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: '#fff', borderRadius: '22px 22px 0 0', padding: 16, maxHeight: '72vh', overflowY: 'auto' }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: T.boja.edge, margin: '0 auto 14px' }} />
              {STAVKE.filter((s) => !GLAVNE_MOBILNE.includes(s.t)).map((s) => (
                <button key={s.t} onClick={() => idi(s.t)} style={{ width: '100%', border: 'none', background: tab === s.t ? T.boja.fill : 'none', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', color: tab === s.t ? T.boja.brand : T.boja.ink, fontSize: 15, fontWeight: 700 }}>
                  <s.Ikona size={22} /> {s.l}
                </button>
              ))}
              <button onClick={() => supabase.auth.signOut()} style={{ width: '100%', border: 'none', background: 'none', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', color: T.boja.red, fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                <SignOut size={22} /> Odjava
              </button>
            </div>
          </div>
        )}
        <style>{ANIM_CSS}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'transparent' }}>
      <aside style={{ width: 244, flex: '0 0 244px', background: 'linear-gradient(180deg, #151d2e 0%, #0e1421 100%)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 14px', overflowY: 'auto', boxShadow: '2px 0 18px rgba(17,24,39,0.12)' }}>
        <div style={{ padding: '0 6px 20px' }}>{marka}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {STAVKE.map((s) => {
            const a = tab === s.t
            return (
              <button key={s.t} onClick={() => idi(s.t)} style={{ border: 'none', background: a ? 'rgba(255,255,255,.07)' : 'none', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', color: a ? T.boja.brand : T.boja.ink400, fontSize: 14, fontWeight: a ? 800 : 600, textAlign: 'left' }}>
                <s.Ikona size={20} weight={a ? 'fill' : 'regular'} /> {s.l}
              </button>
            )
          })}
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ border: 'none', background: 'none', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', color: T.boja.ink400, fontSize: 14, fontWeight: 600 }}>
          <SignOut size={20} /> Odjava
        </button>
      </aside>
      <main style={{ flex: 1, minHeight: '100vh' }}>{prelaz}{ekran}</main>
      <style>{ANIM_CSS}</style>
    </div>
  )
}

export default App
