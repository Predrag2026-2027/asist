import { useEffect, useState } from ''react''
import { Eye, EyeSlash } from ''@phosphor-icons/react''
import { supabase } from ''../../lib/supabase''
import { T, dugme, polje, labela } from ''../../lib/tema''

export default function LoginScreen() {
  const [email, setEmail] = useState('''')
  const [lozinka, setLozinka] = useState('''')
  const [prikaziLoz, setPrikaziLoz] = useState(false)
  const [greska, setGreska] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [radi, setRadi] = useState(false)
  const [sirok, setSirok] = useState(typeof window !== ''undefined'' ? window.innerWidth >= 860 : true)

  useEffect(() => {
    const f = () => setSirok(window.innerWidth >= 860)
    window.addEventListener(''resize'', f)
    return () => window.removeEventListener(''resize'', f)
  }, [])

  function ocisti() {
    if (greska) setGreska(null)
    if (info) setInfo(null)
  }

  async function prijava() {
    setGreska(null)
    setInfo(null)
    if (!email.trim() || !lozinka) {
      setGreska(''Unesi e-mail i lozinku.'')
      return
    }
    if (!email.includes(''@'')) {
      setGreska(''E-mail nije u ispravnom formatu.'')
      return
    }
    setRadi(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: lozinka })
    if (error) setGreska(''Neuspešna prijava. Proveri e-mail i lozinku.'')
    setRadi(false)
  }

  async function zaboravljena() {
    if (!email.trim() || !email.includes(''@'')) {
      setGreska(''Unesi e-mail da bismo poslali link za resetovanje.'')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    if (error) setGreska(''Greška: '' + error.message)
    else setInfo(''Poslali smo link za resetovanje lozinke na tvoj e-mail.'')
  }

  const marka = (tamna: boolean) => (
    <div style={{ display: ''flex'', alignItems: ''center'', gap: 12 }}>
      <div style={{ width: 52, height: 52, borderRadius: T.r.brand, background: T.boja.brand, display: ''flex'', flexDirection: ''column'', alignItems: ''center'', justifyContent: ''center'' }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: ''#fff'', letterSpacing: ''-0.06em'' }}>BB</span>
      </div>
      <div style={{ display: ''flex'', flexDirection: ''column'' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: tamna ? ''#fff'' : T.boja.ink, letterSpacing: ''-0.01em'' }}>Asist</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ''0.14em'', textTransform: ''uppercase'', color: tamna ? T.boja.ink400 : T.boja.ink500 }}>KK BB Basket</span>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: ''100vh'', display: ''flex'', background: T.boja.bg }}>
      {sirok && (
        <div style={{ width: 460, flex: ''0 0 460px'', background: T.boja.ink, padding: ''44px 40px'', display: ''flex'', flexDirection: ''column'', justifyContent: ''space-between'' }}>
          {marka(true)}
          <div style={{ display: ''flex'', flexDirection: ''column'', gap: 12 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: ''#fff'', letterSpacing: ''-0.02em'', lineHeight: 1.2 }}>Ceo klub<br />u jednom ekranu.</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.boja.ink400, lineHeight: 1.6 }}>Prisustvo, članarine, treninzi i finansije — na jednom mestu, dostupno sa telefona.</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>KK BB Basket · Mladenovac</span>
        </div>
      )}

      <div style={{ flex: 1, display: ''flex'', alignItems: ''center'', justifyContent: ''center'', padding: 24 }}>
        <div style={{ width: ''100%'', maxWidth: 400 }}>
          {!sirok && <div style={{ marginBottom: 28 }}>{marka(false)}</div>}
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: ''-0.02em'', margin: ''0 0 4px'' }}>Prijava</h1>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.boja.ink500, margin: ''0 0 24px'' }}>Uđi svojim nalogom trenera.</p>

          <div style={{ marginBottom: 16 }}>
            <label style={labela}>E-MAIL</label>
            <input style={polje} type="email" value={email} onChange={(e) => { setEmail(e.target.value); ocisti() }} onKeyDown={(e) => e.key === ''Enter'' && prijava()} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labela}>LOZINKA</label>
            <div style={{ position: ''relative'' }}>
              <input style={{ ...polje, paddingRight: 44 }} type={prikaziLoz ? ''text'' : ''password''} value={lozinka} onChange={(e) => { setLozinka(e.target.value); ocisti() }} onKeyDown={(e) => e.key === ''Enter'' && prijava()} />
              <button onClick={() => setPrikaziLoz(!prikaziLoz)} style={{ position: ''absolute'', right: 6, top: 6, width: 32, height: 32, border: ''none'', background: ''none'', cursor: ''pointer'', color: T.boja.ink400, display: ''flex'', alignItems: ''center'', justifyContent: ''center'' }} aria-label="Prikaži lozinku">
                {prikaziLoz ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {greska && (
            <div style={{ background: T.boja.redBg, border: `1px solid ${T.boja.redEdge}`, color: T.boja.red700, borderRadius: 11, padding: ''11px 14px'', fontSize: 13, fontWeight: 600, margin: ''12px 0 0'' }}>{greska}</div>
          )}
          {info && (
            <div style={{ background: T.boja.greenBg, border: `1px solid ${T.boja.greenEdge}`, color: T.boja.green700, borderRadius: 11, padding: ''11px 14px'', fontSize: 13, fontWeight: 600, margin: ''12px 0 0'' }}>{info}</div>
          )}

          <button onClick={prijava} disabled={radi} style={{ ...dugme(''brand'', ''lg''), width: ''100%'', marginTop: 18, opacity: radi ? 0.6 : 1 }}>
            {radi ? ''Prijavljivanje...'' : ''Uđi''}
          </button>

          <div style={{ marginTop: 14, textAlign: ''center'' }}>
            <button onClick={zaboravljena} style={{ border: ''none'', background: ''none'', color: T.boja.ink500, fontSize: 13, fontWeight: 700, cursor: ''pointer'' }}>Zaboravljena lozinka?</button>
          </div>
        </div>
      </div>
    </div>
  )
}
