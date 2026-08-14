import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { T, dugme, polje, labela } from '../../lib/tema'

type Dokument = { id: string; naziv: string; kategorija: string | null; putanja: string; velicina: number | null; tip_fajla: string | null; created_at: string }

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

const karta: React.CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 16, padding: 16 }

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
  useEffect(() => { ucitajOsnovu() }, [])

  function izaberiFajl(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFajl(f)
    if (f && !naziv.trim()) setNaziv(f.name)
  }

  async function otpremi() {
    setPoruka(null)
    if (!fajl) { setPoruka({ tip: 'greska', tekst: 'Izaberi fajl.' }); return }
    setRadi(true)
    try {
      const cist = fajl.name.replace(/[^\w.\-]+/g, '_')
      const putanja = `${crypto.randomUUID()}-${cist}`
      const { error: e1 } = await supabase.storage.from('dokumenti').upload(putanja, fajl)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('dokumenti').insert({ sezona_id: sezonaId, naziv: naziv.trim() || fajl.name, kategorija: kategorija || null, putanja, velicina: fajl.size, tip_fajla: fajl.type || null })
      if (e2) throw e2
      setFajl(null); setNaziv(''); setKategorija('')
      setPoruka({ tip: 'uspeh', tekst: 'Dokument je otpremljen.' })
      await ucitaj()
    } catch (err: any) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) }) } finally { setRadi(false) }
  }

  async function preuzmi(d: Dokument) {
    const { data, error } = await supabase.storage.from('dokumenti').createSignedUrl(d.putanja, 120)
    if (error || !data?.signedUrl) { setPoruka({ tip: 'greska', tekst: 'Ne mogu da otvorim fajl.' }); return }
    window.open(data.signedUrl, '_blank')
  }

  async function obrisi(d: Dokument) {
    if (!window.confirm(`Obrisati „${d.naziv}"?`)) return
    await supabase.storage.from('dokumenti').remove([d.putanja])
    const { error } = await supabase.from('dokumenti').delete().eq('id', d.id)
    if (!error) await ucitaj()
  }

  const prikazani = filter === 'Sve' ? dokumenti : dokumenti.filter((d) => (d.kategorija || 'Ostalo') === filter)

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>Dokumentacija i zapisnici</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Fajlovi su dostupni samo prijavljenim korisnicima.</div>
      </div>

      <div style={{ ...karta, marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Novi dokument</div>
        <div style={{ marginBottom: 8 }}>
          <label style={labela}>Fajl</label>
          <input type="file" onChange={izaberiFajl} style={{ fontSize: 14, fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label style={labela}>Naziv</label>
            <input style={polje} value={naziv} onChange={(e) => setNaziv(e.target.value)} placeholder="npr. Zapisnik sa sednice 12.09" />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={labela}>Kategorija</label>
            <select style={polje} value={kategorija} onChange={(e) => setKategorija(e.target.value)}>
              <option value="">— izaberi —</option>
              {KATEGORIJE.map((k) => (<option key={k} value={k}>{k}</option>))}
            </select>
          </div>
        </div>
        <button onClick={otpremi} disabled={radi} style={{ ...dugme('brand', 'md'), width: '100%', opacity: radi ? 0.6 : 1 }}>
          {radi ? 'Otpremam...' : 'Otpremi dokument'}
        </button>
        {poruka && (<p style={{ fontSize: 14, fontWeight: 700, color: poruka.tip === 'greska' ? T.boja.red : T.boja.green700, marginBottom: 0 }}>{poruka.tekst}</p>)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Dokumenti ({prikazani.length})</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {['Sve', ...KATEGORIJE].map((k) => {
          const a = filter === k
          return (
            <button key={k} onClick={() => setFilter(k)} style={{ fontSize: 13, fontWeight: 700, padding: '6px 13px', borderRadius: 99, cursor: 'pointer', border: `1px solid ${a ? T.boja.ink : T.boja.edge}`, background: a ? T.boja.ink : '#fff', color: a ? '#fff' : T.boja.ink600 }}>
              {k}
            </button>
          )
        })}
      </div>

      {prikazani.length === 0 ? (
        <p style={{ color: T.boja.ink500, fontSize: 14, fontWeight: 600 }}>Nema dokumenata.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {prikazani.map((d) => (
            <div key={d.id} style={{ background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.naziv}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>
                  {[d.kategorija, formatDatum(d.created_at), formatVel(d.velicina)].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => preuzmi(d)} style={dugme('outline-black', 'sm')}>Preuzmi</button>
                <button onClick={() => obrisi(d)} style={dugme('outline-danger', 'sm')}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
