import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Dokument = {
  id: string
  naziv: string
  kategorija: string | null
  putanja: string
  velicina: number | null
  tip_fajla: string | null
  created_at: string
}

const boja = {
  tekst: '#1c1c1a',
  meki: '#6b6a64',
  ivica: '#e2e0d8',
  pozadina: '#faf9f5',
  karta: '#ffffff',
  akcenat: '#c2410c',
  greska: '#b91c1c',
  uspeh: '#15803d',
}

const KATEGORIJE = ['Zapisnik', 'Ugovor', 'Odluka', 'Finansijski dokument', 'Dopis', 'Ostalo']

function formatVel(n: number | null): string {
  if (!n) return ''
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB'
  if (n >= 1024) return Math.round(n / 1024) + ' KB'
  return n + ' B'
}
function formatDatum(d: string): string {
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}.`
}

const stilInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: `1px solid ${boja.ivica}`,
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
  background: '#fff',
  color: boja.tekst,
}
const stilLabela: React.CSSProperties = { display: 'block', fontSize: 12, color: boja.meki, marginBottom: 3 }

export default function DokumentiScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [dokumenti, setDokumenti] = useState<Dokument[]>([])
  const [fajl, setFajl] = useState<File | null>(null)
  const [naziv, setNaziv] = useState('')
  const [kategorija, setKategorija] = useState('')
  const [filter, setFilter] = useState('Sve')
  const [poruka, setPoruka] = useState<{ tip: 'greska' | 'uspeh'; tekst: string } | null>(null)
  const [radi, setRadi] = useState(false)

  async function ucitajOsnovu() {
    const { data: sez } = await supabase.from('sezone').select('id').eq('aktivna', true).maybeSingle()
    setSezonaId((sez as any)?.id ?? null)
    await ucitaj()
  }
  async function ucitaj() {
    const { data } = await supabase.from('dokumenti').select('*').order('created_at', { ascending: false })
    setDokumenti((data as any) ?? [])
  }
  useEffect(() => {
    ucitajOsnovu()
  }, [])

  function izaberiFajl(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFajl(f)
    if (f && !naziv.trim()) setNaziv(f.name)
  }

  async function otpremi() {
    setPoruka(null)
    if (!fajl) {
      setPoruka({ tip: 'greska', tekst: 'Izaberi fajl.' })
      return
    }
    setRadi(true)
    try {
      const cist = fajl.name.replace(/[^\w.\-]+/g, '_')
      const putanja = `${crypto.randomUUID()}-${cist}`
      const { error: e1 } = await supabase.storage.from('dokumenti').upload(putanja, fajl)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('dokumenti').insert({
        sezona_id: sezonaId,
        naziv: naziv.trim() || fajl.name,
        kategorija: kategorija || null,
        putanja,
        velicina: fajl.size,
        tip_fajla: fajl.type || null,
      })
      if (e2) throw e2
      setFajl(null)
      setNaziv('')
      setKategorija('')
      setPoruka({ tip: 'uspeh', tekst: 'Dokument je otpremljen.' })
      await ucitaj()
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) })
    } finally {
      setRadi(false)
    }
  }

  async function preuzmi(d: Dokument) {
    const { data, error } = await supabase.storage.from('dokumenti').createSignedUrl(d.putanja, 120)
    if (error || !data?.signedUrl) {
      setPoruka({ tip: 'greska', tekst: 'Ne mogu da otvorim fajl.' })
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function obrisi(d: Dokument) {
    if (!window.confirm(`Obrisati „${d.naziv}"?`)) return
    await supabase.storage.from('dokumenti').remove([d.putanja])
    const { error } = await supabase.from('dokumenti').delete().eq('id', d.id)
    if (!error) await ucitaj()
  }

  const prikazani = filter === 'Sve' ? dokumenti : dokumenti.filter((d) => (d.kategorija || 'Ostalo') === filter)

  const dugmeMalo: React.CSSProperties = {
    background: 'none',
    border: `1px solid ${boja.ivica}`,
    borderRadius: 8,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 13,
    color: boja.tekst,
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: boja.pozadina, color: boja.tekst, minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 2px' }}>Dokumentacija i zapisnici</h1>
        <p style={{ color: boja.meki, marginTop: 0, fontSize: 14 }}>Fajlovi su dostupni samo prijavljenim korisnicima.</p>

        <div style={{ background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 12, padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Novi dokument</div>
          <div style={{ marginBottom: 8 }}>
            <label style={stilLabela}>Fajl</label>
            <input type="file" onChange={izaberiFajl} style={{ fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 160 }}>
              <label style={stilLabela}>Naziv</label>
              <input style={stilInput} value={naziv} onChange={(e) => setNaziv(e.target.value)} placeholder="npr. Zapisnik sa sednice 12.09" />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={stilLabela}>Kategorija</label>
              <select style={stilInput} value={kategorija} onChange={(e) => setKategorija(e.target.value)}>
                <option value="">— izaberi —</option>
                {KATEGORIJE.map((k) => (<option key={k} value={k}>{k}</option>))}
              </select>
            </div>
          </div>
          <button onClick={otpremi} disabled={radi} style={{ width: '100%', background: boja.akcenat, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 15, fontWeight: 600, cursor: radi ? 'default' : 'pointer', opacity: radi ? 0.6 : 1 }}>
            {radi ? 'Otpremam...' : 'Otpremi dokument'}
          </button>
          {poruka && (<p style={{ fontSize: 14, color: poruka.tip === 'greska' ? boja.greska : boja.uspeh, marginBottom: 0 }}>{poruka.tekst}</p>)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 8px', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Dokumenti ({prikazani.length})</h2>
          <select style={{ ...stilInput, width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="Sve">Sve kategorije</option>
            {KATEGORIJE.map((k) => (<option key={k} value={k}>{k}</option>))}
          </select>
        </div>

        {prikazani.length === 0 ? (
          <p style={{ color: boja.meki, fontSize: 14 }}>Nema dokumenata.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prikazani.map((d) => (
              <div key={d.id} style={{ background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.naziv}</div>
                  <div style={{ fontSize: 12, color: boja.meki }}>
                    {[d.kategorija, formatDatum(d.created_at), formatVel(d.velicina)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => preuzmi(d)} style={dugmeMalo}>Preuzmi</button>
                  <button onClick={() => obrisi(d)} style={{ ...dugmeMalo, color: boja.greska }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
