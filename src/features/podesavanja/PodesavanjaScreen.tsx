import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { T, dugme, polje, labela } from '../../lib/tema'
import { type CenRed } from '../../lib/cenovnik'

type Trener = { id: string; ime: string; telefon: string | null; aktivan: boolean; uloga: string | null }

const MESECI: Record<number, string> = {
  1: 'Januar', 2: 'Februar', 3: 'Mart', 4: 'April', 5: 'Maj', 6: 'Jun',
  7: 'Jul', 8: 'Avgust', 9: 'Septembar', 10: 'Oktobar', 11: 'Novembar', 12: 'Decembar',
}
const REDOSLED = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]
const ULOGE = ['trener', 'pomoćni trener', 'administrator']

const karta: React.CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 16, padding: 16, marginBottom: 14 }
const pilula = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 99, background: bg, color: fg, display: 'inline-block' })

function formatDMY(d: string | null): string { if (!d) return ''; const [g, m, dan] = d.split('-'); return `${dan}.${m}.${g}.` }
function danPre(d: string): string {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() - 1)
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
function formatRSD(n: number): string { return new Intl.NumberFormat('sr-RS').format(n) + ' RSD' }

export default function PodesavanjaScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [datumOd, setDatumOd] = useState('')
  const [datumDo, setDatumDo] = useState('')
  const [cene, setCene] = useState<CenRed[]>([])
  const [npId, setNpId] = useState<string | null>(null)
  const [meseci, setMeseci] = useState<number[]>([])
  const [treneri, setTreneri] = useState<Trener[]>([])
  const [poruka, setPoruka] = useState<{ tip: 'greska' | 'uspeh'; tekst: string; gde: string } | null>(null)
  const [radi, setRadi] = useState(false)

  const [nvOd, setNvOd] = useState('')
  const [nc1, setNc1] = useState('')
  const [nc2, setNc2] = useState('')
  const [nc3, setNc3] = useState('')
  const [editCenaId, setEditCenaId] = useState<string | null>(null)
  const [ec1, setEc1] = useState('')
  const [ec2, setEc2] = useState('')
  const [ec3, setEc3] = useState('')
  const [eOd, setEOd] = useState('')
  const [eDo, setEDo] = useState('')

  const [novoIme, setNovoIme] = useState('')
  const [noviTel, setNoviTel] = useState('')
  const [novaUloga, setNovaUloga] = useState('trener')
  const [editId, setEditId] = useState<string | null>(null)
  const [eIme, setEIme] = useState('')
  const [eTel, setETel] = useState('')
  const [eUloga, setEUloga] = useState('trener')

  async function ucitaj() {
    const { data: sez } = await supabase.from('sezone').select('id, datum_od, datum_do').eq('aktivna', true).maybeSingle()
    const s = sez as any
    if (!s) return
    setSezonaId(s.id)
    setDatumOd(s.datum_od ?? '')
    setDatumDo(s.datum_do ?? '')
    setNvOd(s.datum_od ?? '')
    await ucitajCene(s.id)
    const { data: np } = await supabase.from('naplatni_period').select('id, meseci').eq('sezona_id', s.id).is('grupa_id', null).maybeSingle()
    if (np) { setNpId((np as any).id); setMeseci(((np as any).meseci as number[]) ?? []) }
    else setMeseci([9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7])
    const { data: tr } = await supabase.from('treneri').select('id, ime, telefon, aktivan, uloga').order('ime')
    setTreneri((tr as any) ?? [])
  }

  async function ucitajCene(sid: string) {
    const { data } = await supabase.from('cenovnik').select('id, iznos_1_dete, iznos_2_dete, iznos_3plus, vazi_od, vazi_do').eq('sezona_id', sid).order('vazi_od')
    setCene((data as any) ?? [])
  }

  useEffect(() => { ucitaj() }, [])

  async function dodajCenu() {
    setPoruka(null)
    const n1 = Number(nc1.replace(',', '.')), n2 = Number(nc2.replace(',', '.')), n3 = Number(nc3.replace(',', '.'))
    if (!nvOd) { setPoruka({ tip: 'greska', tekst: 'Unesi datum od kog cena važi.', gde: 'cena' }); return }
    if ([n1, n2, n3].some((x) => isNaN(x) || x < 0)) { setPoruka({ tip: 'greska', tekst: 'Unesi ispravne iznose.', gde: 'cena' }); return }
    setRadi(true)
    try {
      const otvorena = cene.filter((c) => !c.vazi_do && (c.vazi_od ?? '') < nvOd).sort((a, b) => (b.vazi_od ?? '').localeCompare(a.vazi_od ?? ''))[0]
      if (otvorena) {
        const { error: eZ } = await supabase.from('cenovnik').update({ vazi_do: danPre(nvOd) }).eq('id', otvorena.id)
        if (eZ) throw eZ
      }
      const { error } = await supabase.from('cenovnik').insert({ sezona_id: sezonaId, iznos_1_dete: n1, iznos_2_dete: n2, iznos_3plus: n3, valuta: 'RSD', vazi_od: nvOd, vazi_do: null })
      if (error) throw error
      setNc1(''); setNc2(''); setNc3('')
      setPoruka({ tip: 'uspeh', tekst: `Nova cena važi od ${formatDMY(nvOd)} Prethodna je zatvorena danom ranije.`, gde: 'cena' })
      if (sezonaId) await ucitajCene(sezonaId)
    } catch (err: any) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)), gde: 'cena' }) } finally { setRadi(false) }
  }

  function pocniIzmenuCene(c: CenRed) {
    setEditCenaId(c.id)
    setEc1(String(Number(c.iznos_1_dete)))
    setEc2(String(Number(c.iznos_2_dete)))
    setEc3(String(Number(c.iznos_3plus)))
    setEOd(c.vazi_od ?? '')
    setEDo(c.vazi_do ?? '')
    setPoruka(null)
  }

  async function sacuvajCenu(id: string) {
    const n1 = Number(ec1.replace(',', '.')), n2 = Number(ec2.replace(',', '.')), n3 = Number(ec3.replace(',', '.'))
    if ([n1, n2, n3].some((x) => isNaN(x) || x < 0)) { setPoruka({ tip: 'greska', tekst: 'Unesi ispravne iznose.', gde: 'cena' }); return }
    const { error } = await supabase.from('cenovnik').update({ iznos_1_dete: n1, iznos_2_dete: n2, iznos_3plus: n3, vazi_od: eOd || null, vazi_do: eDo || null }).eq('id', id)
    if (error) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + error.message, gde: 'cena' }); return }
    setEditCenaId(null)
    if (sezonaId) await ucitajCene(sezonaId)
    setPoruka({ tip: 'uspeh', tekst: 'Cena je izmenjena.', gde: 'cena' })
  }

  async function obrisiCenu(id: string) {
    if (!window.confirm('Obrisati ovu cenu?')) return
    const { error } = await supabase.from('cenovnik').delete().eq('id', id)
    if (error) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + error.message, gde: 'cena' }); return }
    if (sezonaId) await ucitajCene(sezonaId)
  }

  async function sacuvajSezonu() {
    setPoruka(null)
    if (!datumOd || !datumDo) { setPoruka({ tip: 'greska', tekst: 'Unesi oba datuma.', gde: 'sezona' }); return }
    setRadi(true)
    try {
      const { error } = await supabase.from('sezone').update({ datum_od: datumOd, datum_do: datumDo }).eq('id', sezonaId)
      if (error) throw error
      setPoruka({ tip: 'uspeh', tekst: 'Sezona je sačuvana.', gde: 'sezona' })
    } catch (err: any) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)), gde: 'sezona' }) } finally { setRadi(false) }
  }

  function toggleMesec(m: number) {
    setMeseci((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  async function sacuvajMesece() {
    setPoruka(null)
    setRadi(true)
    try {
      const sortirani = REDOSLED.filter((m) => meseci.includes(m))
      if (npId) {
        const { error } = await supabase.from('naplatni_period').update({ meseci: sortirani }).eq('id', npId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('naplatni_period').insert({ sezona_id: sezonaId, grupa_id: null, meseci: sortirani }).select('id').single()
        if (error) throw error
        setNpId((data as any).id)
      }
      setPoruka({ tip: 'uspeh', tekst: 'Meseci naplate su sačuvani.', gde: 'meseci' })
    } catch (err: any) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)), gde: 'meseci' }) } finally { setRadi(false) }
  }

  async function dodajTrenera() {
    setPoruka(null)
    if (!novoIme.trim()) { setPoruka({ tip: 'greska', tekst: 'Unesi ime trenera.', gde: 'treneri' }); return }
    const { data, error } = await supabase.from('treneri').insert({ ime: novoIme.trim(), telefon: noviTel.trim() || null, uloga: novaUloga, aktivan: true }).select('id, ime, telefon, aktivan, uloga').single()
    if (error) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + error.message, gde: 'treneri' }); return }
    setTreneri([...treneri, data as any].sort((a, b) => a.ime.localeCompare(b.ime)))
    setNovoIme(''); setNoviTel(''); setNovaUloga('trener')
  }

  function pocniIzmenu(t: Trener) {
    setEditId(t.id); setEIme(t.ime); setETel(t.telefon ?? ''); setEUloga(t.uloga ?? 'trener'); setPoruka(null)
  }

  async function sacuvajTrenera(id: string) {
    if (!eIme.trim()) { setPoruka({ tip: 'greska', tekst: 'Ime ne može biti prazno.', gde: 'treneri' }); return }
    const { error } = await supabase.from('treneri').update({ ime: eIme.trim(), telefon: eTel.trim() || null, uloga: eUloga }).eq('id', id)
    if (error) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + error.message, gde: 'treneri' }); return }
    setTreneri(treneri.map((t) => (t.id === id ? { ...t, ime: eIme.trim(), telefon: eTel.trim() || null, uloga: eUloga } : t)).sort((a, b) => a.ime.localeCompare(b.ime)))
    setEditId(null)
  }

  async function toggleAktivan(t: Trener) {
    const { error } = await supabase.from('treneri').update({ aktivan: !t.aktivan }).eq('id', t.id)
    if (error) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + error.message, gde: 'treneri' }); return }
    setTreneri(treneri.map((x) => (x.id === t.id ? { ...x, aktivan: !x.aktivan } : x)))
  }

  const p = (gde: string) => (poruka && poruka.gde === gde ? <p style={{ fontSize: 13, fontWeight: 700, color: poruka.tip === 'greska' ? T.boja.red : T.boja.green700, marginBottom: 0 }}>{poruka.tekst}</p> : null)

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>Podešavanja</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Cena, sezona, meseci naplate i treneri.</div>
      </div>

      <div style={karta}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Cena članarine (po periodima)</div>
        <p style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500, marginTop: 0 }}>Svaka cena važi od zadatog datuma. Obračun za neki mesec povlači cenu koja je važila u tom mesecu; već obračunata zaduženja ostaju nepromenjena.</p>

        {cene.length === 0 ? (
          <p style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Još nema definisanih cena. Dodaj prvu ispod.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {cene.map((c) => (
              <div key={c.id} style={{ border: `1px solid ${T.boja.edge}`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>od {formatDMY(c.vazi_od)}</span>
                      {c.vazi_do ? <span style={pilula(T.boja.fill, T.boja.ink600)}>do {formatDMY(c.vazi_do)}</span> : <span style={pilula(T.boja.greenBg, T.boja.green700)}>trenutna</span>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500, marginTop: 2 }}>
                      1: {formatRSD(Number(c.iznos_1_dete))} · 2: {formatRSD(Number(c.iznos_2_dete))} · 3+: {formatRSD(Number(c.iznos_3plus))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => pocniIzmenuCene(c)} style={dugme('outline-black', 'sm')}>Izmeni</button>
                    <button onClick={() => obrisiCenu(c.id)} style={dugme('outline-danger', 'sm')}>×</button>
                  </div>
                </div>

                {editCenaId === c.id && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${T.boja.edge}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 80 }}><label style={labela}>1. dete</label><input style={polje} value={ec1} onChange={(e) => setEc1(e.target.value)} inputMode="numeric" /></div>
                      <div style={{ flex: 1, minWidth: 80 }}><label style={labela}>2. dete</label><input style={polje} value={ec2} onChange={(e) => setEc2(e.target.value)} inputMode="numeric" /></div>
                      <div style={{ flex: 1, minWidth: 80 }}><label style={labela}>3.+ dete</label><input style={polje} value={ec3} onChange={(e) => setEc3(e.target.value)} inputMode="numeric" /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 130 }}><label style={labela}>Važi od</label><input type="date" style={polje} value={eOd} onChange={(e) => setEOd(e.target.value)} /></div>
                      <div style={{ flex: 1, minWidth: 130 }}><label style={labela}>Važi do (prazno = trenutna)</label><input type="date" style={polje} value={eDo} onChange={(e) => setEDo(e.target.value)} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => sacuvajCenu(c.id)} style={{ ...dugme('brand', 'md'), flex: 1 }}>Sačuvaj</button>
                      <button onClick={() => setEditCenaId(null)} style={dugme('ghost-black', 'md')}>Otkaži</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ border: `1px solid ${T.boja.edge}`, borderRadius: 12, padding: 12, background: T.boja.bg }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Nova cena</div>
          <div style={{ marginBottom: 8 }}>
            <label style={labela}>Važi od</label>
            <input type="date" style={polje} value={nvOd} onChange={(e) => setNvOd(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 80 }}><label style={labela}>1. dete</label><input style={polje} value={nc1} onChange={(e) => setNc1(e.target.value)} inputMode="numeric" /></div>
            <div style={{ flex: 1, minWidth: 80 }}><label style={labela}>2. dete</label><input style={polje} value={nc2} onChange={(e) => setNc2(e.target.value)} inputMode="numeric" /></div>
            <div style={{ flex: 1, minWidth: 80 }}><label style={labela}>3.+ dete</label><input style={polje} value={nc3} onChange={(e) => setNc3(e.target.value)} inputMode="numeric" /></div>
          </div>
          <button onClick={dodajCenu} disabled={radi} style={dugme('brand', 'md')}>+ Dodaj cenu</button>
        </div>
        <div style={{ marginTop: 8 }}>{p('cena')}</div>
      </div>

      <div style={karta}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Sezona</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={labela}>Početak sezone</label>
            <input type="date" style={polje} value={datumOd} onChange={(e) => setDatumOd(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={labela}>Kraj sezone</label>
            <input type="date" style={polje} value={datumDo} onChange={(e) => setDatumDo(e.target.value)} />
          </div>
        </div>
        <button onClick={sacuvajSezonu} disabled={radi} style={dugme('brand', 'md')}>Sačuvaj sezonu</button>
        <div style={{ marginTop: 8 }}>{p('sezona')}</div>
      </div>

      <div style={karta}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Meseci naplate</div>
        <p style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500, marginTop: 0 }}>Označi mesece u kojima se naplaćuje članarina.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {REDOSLED.map((m) => {
            const a = meseci.includes(m)
            return (
              <button key={m} onClick={() => toggleMesec(m)} style={{ fontSize: 13, fontWeight: 700, padding: '7px 12px', borderRadius: 99, cursor: 'pointer', border: `1px solid ${a ? T.boja.ink : T.boja.edge}`, background: a ? T.boja.ink : '#fff', color: a ? '#fff' : T.boja.ink600 }}>
                {MESECI[m]}
              </button>
            )
          })}
        </div>
        <button onClick={sacuvajMesece} disabled={radi} style={dugme('brand', 'md')}>Sačuvaj mesece</button>
        <div style={{ marginTop: 8 }}>{p('meseci')}</div>
      </div>

      <div style={karta}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Treneri</div>

        <div style={{ border: `1px solid ${T.boja.edge}`, borderRadius: 12, padding: 12, marginBottom: 12, background: T.boja.bg }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Novi trener</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ flex: 2, minWidth: 140 }}>
              <label style={labela}>Ime i prezime</label>
              <input style={polje} value={novoIme} onChange={(e) => setNovoIme(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={labela}>Telefon</label>
              <input style={polje} value={noviTel} onChange={(e) => setNoviTel(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labela}>Uloga (oznaka)</label>
            <select style={polje} value={novaUloga} onChange={(e) => setNovaUloga(e.target.value)}>
              {ULOGE.map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
          </div>
          <button onClick={dodajTrenera} style={dugme('brand', 'md')}>+ Dodaj trenera</button>
        </div>

        {treneri.length === 0 ? (
          <p style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Još nema unetih trenera.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {treneri.map((t) => (
              <div key={t.id} style={{ border: `1px solid ${T.boja.edge}`, borderRadius: 12, padding: '10px 12px', opacity: t.aktivan ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{t.ime}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>{[t.uloga, t.telefon].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={t.aktivan ? pilula(T.boja.greenBg, T.boja.green700) : pilula(T.boja.fill, T.boja.ink500)}>{t.aktivan ? 'Aktivan' : 'Neaktivan'}</span>
                    <button onClick={() => pocniIzmenu(t)} style={dugme('outline-black', 'sm')}>Izmeni</button>
                    <button onClick={() => toggleAktivan(t)} style={t.aktivan ? dugme('outline-danger', 'sm') : dugme('outline-black', 'sm')}>{t.aktivan ? 'Deaktiviraj' : 'Aktiviraj'}</button>
                  </div>
                </div>

                {editId === t.id && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${T.boja.edge}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 2, minWidth: 140 }}>
                        <label style={labela}>Ime</label>
                        <input style={polje} value={eIme} onChange={(e) => setEIme(e.target.value)} />
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <label style={labela}>Telefon</label>
                        <input style={polje} value={eTel} onChange={(e) => setETel(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label style={labela}>Uloga</label>
                      <select style={polje} value={eUloga} onChange={(e) => setEUloga(e.target.value)}>
                        {ULOGE.map((u) => (<option key={u} value={u}>{u}</option>))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => sacuvajTrenera(t.id)} style={{ ...dugme('brand', 'md'), flex: 1 }}>Sačuvaj</button>
                      <button onClick={() => setEditId(null)} style={dugme('ghost-black', 'md')}>Otkaži</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 8 }}>{p('treneri')}</div>
        <p style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500, marginTop: 10 }}>
          Neaktivni treneri ne pojavljuju se pri unosu novih uplata/treninga, ali ostaju u istoriji i izveštajima. „Uloga" je za sada oznaka — prave privilegije (sopstveni nalozi + ograničenja) uvodimo kao poseban korak.
        </p>
      </div>
    </div>
  )
}
