import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [sezone, setSezone] = useState<any[]>([])
  const [greska, setGreska] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('sezone')
      .select('*')
      .then(({ data, error }) => {
        if (error) setGreska(error.message)
        else setSezone(data ?? [])
      })
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Asist — test veze</h1>
      {greska && <p style={{ color: 'crimson' }}>Greška: {greska}</p>}
      {!greska && sezone.length === 0 && <p>Učitavam...</p>}
      <ul>
        {sezone.map((s) => (
          <li key={s.id}>
            {s.naziv} {s.aktivna ? '(aktivna)' : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App