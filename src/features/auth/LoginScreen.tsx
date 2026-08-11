import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const boja = {
  tekst: '#1c1c1a',
  meki: '#6b6a64',
  ivica: '#e2e0d8',
  pozadina: '#faf9f5',
  karta: '#ffffff',
  akcenat: '#c2410c',
  greska: '#b91c1c',
}

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [lozinka, setLozinka] = useState('')
  const [greska, setGreska] = useState<string | null>(null)
  const [radi, setRadi] = useState(false)

  async function prijava() {
    setGreska(null)
    if (!email.trim() || !lozinka) {
      setGreska('Unesi email i lozinku.')
      return
    }
    setRadi(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: lozinka,
    })
    if (error) setGreska('Neuspešna prijava. Proveri email i lozinku.')
    setRadi(false)
  }

  const stilInput: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${boja.ivica}`,
    borderRadius: 8,
    fontSize: 15,
    boxSizing: 'border-box',
    background: '#fff',
    color: boja.tekst,
    marginBottom: 12,
  }

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        background: boja.pozadina,
        color: boja.tekst,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: boja.karta,
          border: `1px solid ${boja.ivica}`,
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 360,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Asist</h1>
        <p style={{ color: boja.meki, marginTop: 0, fontSize: 14 }}>
          KK BB Basket · prijava
        </p>

        <label style={{ display: 'block', fontSize: 13, color: boja.meki, marginBottom: 4 }}>Email</label>
        <input
          style={stilInput}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && prijava()}
        />

        <label style={{ display: 'block', fontSize: 13, color: boja.meki, marginBottom: 4 }}>Lozinka</label>
        <input
          style={stilInput}
          type="password"
          value={lozinka}
          onChange={(e) => setLozinka(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && prijava()}
        />

        {greska && (
          <p style={{ color: boja.greska, fontSize: 14, marginTop: 0 }}>{greska}</p>
        )}

        <button
          onClick={prijava}
          disabled={radi}
          style={{
            width: '100%',
            background: boja.akcenat,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 15,
            fontWeight: 600,
            cursor: radi ? 'default' : 'pointer',
            opacity: radi ? 0.6 : 1,
            marginTop: 4,
          }}
        >
          {radi ? 'Prijavljivanje...' : 'Prijavi se'}
        </button>
      </div>
    </div>
  )
}
