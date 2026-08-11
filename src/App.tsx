import { useState } from 'react'
import PorodiceScreen from './features/porodice/PorodiceScreen'
import ClanarineScreen from './features/clanarine/ClanarineScreen'

type Tab = 'porodice' | 'clanarine'

function App() {
  const [tab, setTab] = useState<Tab>('porodice')

  const dugme = (t: Tab, labela: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        flex: 1,
        padding: '12px 8px',
        border: 'none',
        background: 'none',
        fontSize: 15,
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
      <nav
        style={{
          display: 'flex',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#ffffff',
          borderBottom: '1px solid #e2e0d8',
          maxWidth: 640,
          margin: '0 auto',
        }}
      >
        {dugme('porodice', 'Porodice')}
        {dugme('clanarine', 'Članarine')}
      </nav>
      {tab === 'porodice' ? <PorodiceScreen /> : <ClanarineScreen />}
    </div>
  )
}

export default App
