import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CalendarCheck, Basketball, Receipt, UsersThree, ChartBar, ChartLineUp, ChatCircleText, FolderSimple, UploadSimple, DotsThreeOutline, SignOut } from '@phosphor-icons/react'
import { supabase } from './lib/supabase'
import { T } from './lib/tema'
import DanasScreen from './features/danas/DanasScreen'
import PorodiceScreen from './features/porodice/PorodiceScreen'
import ClanarineScreen from './features/clanarine/ClanarineScreen'
import TreninziScreen from './features/treninzi/TreninziScreen'
import StatistikaScreen from './features/statistika/StatistikaScreen'
import FinansijeScreen from './features/finansije/FinansijeScreen'
import ObavestenjaScreen from './features/obavestenja/ObavestenjaScreen'
import DokumentiScreen from './features/dokumenti/DokumentiScreen'
import UvozScreen from './features/uvoz/UvozScreen'
import LoginScreen from './features/auth/LoginScreen'

type Tab = 'danas' | 'treninzi' | 'clanarine' | 'porodice' | 'statistika' | 'finansije' | 'obavestenja' | 'dokumenti' | 'uvoz'

const STAVKE: { t: Tab; l: string; Ikona: any }[] = [
  { t: 'danas', l: 'Danas', Ikona: CalendarCheck },
  { t: 'treninzi', l: 'Treninzi', Ikona: Basketball },
  { t: 'clanarine', l: 'Članarine', Ikona: Receipt },
  { t: 'porodice', l: 'Porodice', Ikona: UsersThree },
  { t: 'statistika', l: 'Statistika', Ikona: ChartBar },
  { t: 'finansije', l: 'Finansije', Ikona: ChartLineUp },
  { t: 'obavestenja', l: 'Obaveštenja', Ikona: ChatCircleText },
  { t: 'dokumenti', l: 'Dokumenti', Ikona: FolderSimple },
  { t: 'uvoz', l: 'Uvoz', Ikona: UploadSimple },
]
const GLAVNE_MOBILNE: Tab[] = ['danas', 'treninzi', 'clanarine', 'porodice']

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ucitava, setUcitava] = useState(true)
  const [tab, setTab] = useState<Tab>('danas')
  const [vise, setVise] = useState(false)
  const [mobilni, setMobilni] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setUcitava(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    const rf = () => setMobilni(window.innerWidth < 900)
    window.addEventListener('resize', rf)
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('resize', rf) }
  }, [])

  if (ucitava) return <div style={{ padding: 24, color: T.boja.ink500 }}>Učitavam...</div>
  if (!session) return <LoginScreen />

  function idi(t: Tab) { setTab(t); setVise(false) }

  const ekran = (
    <>
      {tab === 'danas' && <DanasScreen onNavigate={(t) => idi(t as Tab)} />}
      {tab === 'porodice' && <PorodiceScreen />}
      {tab === 'clanarine' && <ClanarineScreen />}
      {tab === 'treninzi' && <TreninziScreen />}
      {tab === 'statistika' && <StatistikaScreen />}
      {tab === 'finansije' && <FinansijeScreen />}
      {tab === 'obavestenja' && <ObavestenjaScreen />}
      {tab === 'dokumenti' && <DokumentiScreen />}
      {tab === 'uvoz' && <UvozScreen />}
    </>
  )

  const marka = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 40, height: 40, borderRadius: T.r.brand, background: T.boja.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      <div style={{ minHeight: '100vh', background: T.boja.bg }}>
        <main style={{ paddingBottom: 78 }}>{ekran}</main>
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: T.boja.ink, display: 'flex', borderTop: `1px solid ${T.boja.ink800}`, zIndex: 50 }}>
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
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: '#fff', borderRadius: '22px 22px 0 0', padding: 16, maxHeight: '70vh', overflowY: 'auto' }}>
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
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.boja.bg }}>
      <aside style={{ width: 244, flex: '0 0 244px', background: T.boja.ink, position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 14px' }}>
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
      <main style={{ flex: 1, minHeight: '100vh' }}>{ekran}</main>
    </div>
  )
}

export default App
