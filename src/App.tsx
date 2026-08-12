import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import PorodiceScreen from './features/porodice/PorodiceScreen'
import ClanarineScreen from './features/clanarine/ClanarineScreen'
import TreninziScreen from './features/treninzi/TreninziScreen'
import UvozScreen from './features/uvoz/UvozScreen'
import LoginScreen from './features/auth/LoginScreen'

type Tab = 'porodice' | 'clanarine' | 'treninzi' | 'uvoz'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ucitava, setUcitava] = useState(true)
  const [tab, setTab] = useState<Tab>('porodice')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUcitava(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (ucitava) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, color: '#6b6a64' }}>
        Učitavam...
      </div>
    )
  }

  if (!session) return <LoginScreen />

  const dugme = (t: Tab, labela: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        flex: 1,
        padding: '12px 6px',
        border: 'none',
        background: 'none',
        fontSize: 14,
        fontWeight: tab === t ? 600 : 400,
        color: tab === t ? '#c2410c' : '#6b6a64',
        borderBottom: tab === t ? '2px solid #c2410c' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      {labela}
    </button>
  )

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          background: '#ffffff',
          borderBottom: '1px solid #e2e0d8',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flex: 1 }}>
            {dugme('porodice', 'Porodice')}
            {dugme('clanarine', 'Članarine')}
            {dugme('treninzi', 'Treninzi')}
            {dugme('uvoz', 'Uvoz')}
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              border: 'none',
              background: 'none',
              color: '#6b6a64',
              fontSize: 13,
              cursor: 'pointer',
              padding: '0 12px',
            }}
          >
            Odjava
          </button>
        </div>
      </div>
      {tab === 'porodice' && <PorodiceScreen />}
      {tab === 'clanarine' && <ClanarineScreen />}
      {tab === 'treninzi' && <TreninziScreen />}
      {tab === 'uvoz' && <UvozScreen />}
    </div>
  )
}

export default App
