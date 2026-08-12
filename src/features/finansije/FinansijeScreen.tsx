import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

type Transakcija = {
  id: string
  tip: string
  kategorija: string | null
  iznos: number
  datum: string
  opis: string | null
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

const MESECI: Record<number, string> = {
  1: 'Januar', 2: 'Februar', 3: 'Mart', 4: 'April', 5: 'Maj', 6: 'Jun',
  7: 'Jul', 8: 'Avgust', 9: 'Septembar', 10: 'Oktobar', 11: 'Novembar', 12: 'Decembar',
}
const KATEGORIJE: Record<string, string[]> = {
  prihod: ['Donacija', 'Sponzorstvo', 'Kotizacija', 'Ostalo'],
  rashod: ['Zakup hale', 'Sudije', 'Oprema', 'Honorari', 'Kotizacije/takse', 'Putovanja', 'Ostalo'],
}

function formatRSD(n: number): string {
  return new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 0 }).format(n) + ' RSD'
}
function formatDatum(d: string): string {
  const [g, m, dan] = d.split('-')
  return `${dan}.${m}.${g}.`
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

export default function FinansijeScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [datumOd, setDatumOd] = useState('')
  const [datumDo, setDatumDo] = useState('')
  const [pocetnaGodina, setPocetnaGodina] = useState(new Date().getFullYear())
  const [period, setPeriod] = useState('sezona')
  const [transakcije, setTransakcije] = useState<Transakcija[]>([])
  const [clanarine, setClanarine] = useState(0)
  const [poruka, setPoruka] = useState<{ tip: 'greska' | 'uspeh'; tekst: string } | null>(null)
  const [radi, setRadi] = useState(false)

  const [tip, setTip] = useState<'prihod' | 'rashod'>('rashod')
  const [kategorija, setKategorija] = useState('')
  const [iznos, setIznos] = useState('')
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10))
  const [opis, setOpis] = useState('')

  const meseci = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]

  function rasponPerioda(): { od: string; do: string } {
    if (period === 'sezona') return { od: datumOd, do: datumDo }
    const m = Number(period)
    const g = m >= 9 ? pocetnaGodina : pocetnaGodina + 1
    const od = `${g}-${String(m).padStart(2, '0')}-01`
    const poslednji = new Date(g, m, 0).getDate()
    const do_ = `${g}-${String(m).padStart(2, '0')}-${poslednji}`
    return { od, do: do_ }
  }

  async function ucitajOsnovu() {
    const { data: sez } = await supabase.from('sezone').select('id, datum_od, datum_do').eq('aktivna', true).maybeSingle()
    const s = sez as any
    if (!s) return
    setSezonaId(s.id)
    setDatumOd(s.datum_od)
    setDatumDo(s.datum_do)
    setPocetnaGodina(s.datum_od ? new Date(s.datum_od).getFullYear() : new Date().getFullYear())
  }

  async function ucitaj() {
    if (!sezonaId) return
    const { od, do: do_ } = rasponPerioda()

    const { data: tr } = await supabase
      .from('finansije_transakcije')
      .select('id, tip, kategorija, iznos, datum, opis')
      .eq('sezona_id', sezonaId)
      .gte('datum', od)
      .lte('datum', do_)
      .order('datum', { ascending: false })
    setTransakcije((tr as any) ?? [])

    const { data: up } = await supabase
      .from('uplate')
      .select('iznos, datum, zaduzenja!inner(sezona_id)')
      .eq('zaduzenja.sezona_id', sezonaId)
      .gte('datum', od)
      .lte('datum', do_)
    const zbir = ((up as any[]) ?? []).reduce((s, u) => s + Number(u.iznos), 0)
    setClanarine(zbir)
  }

  useEffect(() => {
    ucitajOsnovu()
  }, [])
  useEffect(() => {
    if (sezonaId) ucitaj()
  }, [sezonaId, period])

  async function dodaj() {
    setPoruka(null)
    const suma = Number(iznos.replace(',', '.'))
    if (!suma || suma <= 0) {
      setPoruka({ tip: 'greska', tekst: 'Unesi ispravan iznos.' })
      return
    }
    setRadi(true)
    try {
      const { error } = await supabase.from('finansije_transakcije').insert({
        sezona_id: sezonaId,
        tip,
        kategorija: kategorija || null,
        iznos: suma,
        datum,
        opis: opis.trim() || null,
      })
      if (error) throw error
      setIznos('')
      setOpis('')
      setKategorija('')
      setPoruka({ tip: 'uspeh', tekst: 'Transakcija dodata.' })
      await ucitaj()
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) })
    } finally {
      setRadi(false)
    }
  }

  async function obrisi(id: string) {
    if (!window.confirm('Obrisati ovu transakciju?')) return
    const { error } = await supabase.from('finansije_transakcije').delete().eq('id', id)
    if (!error) await ucitaj()
  }

  const ostaliPrihodi = transakcije.filter((t) => t.tip === 'prihod').reduce((s, t) => s + Number(t.iznos), 0)
  const rashodi = transakcije.filter((t) => t.tip === 'rashod').reduce((s, t) => s + Number(t.iznos), 0)
  const ukupniPrihodi = clanarine + ostaliPrihodi
  const saldo = ukupniPrihodi - rashodi

  function izvezi() {
    const labelP = period === 'sezona' ? 'Cela_sezona' : MESECI[Number(period)]
    const podaci = [
      { Stavka: 'Članarine (uplate)', Iznos: clanarine },
      { Stavka: 'Ostali prihodi', Iznos: ostaliPrihodi },
      { Stavka: 'Rashodi', Iznos: -rashodi },
      { Stavka: 'SALDO', Iznos: saldo },
      {},
      ...transakcije.map((t) => ({
        Datum: formatDatum(t.datum),
        Tip: t.tip === 'prihod' ? 'Prihod' : 'Rashod',
        Kategorija: t.kategorija ?? '',
        Opis: t.opis ?? '',
        Iznos: t.tip === 'rashod' ? -Number(t.iznos) : Number(t.iznos),
      })),
    ]
    const ws = XLSX.utils.json_to_sheet(podaci)
    ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 18 }, { wch: 24 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Finansije')
    XLSX.writeFile(wb, `Finansije_${labelP}.xlsx`)
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: boja.pozadina, color: boja.tekst, minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 2px' }}>Finansije kluba</h1>
        <p style={{ color: boja.meki, marginTop: 0, fontSize: 14 }}>Sezona 2026/2027</p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', margin: '12px 0' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={stilLabela}>Period</label>
            <select style={stilInput} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="sezona">Cela sezona</option>
              {meseci.map((m) => (
                <option key={m} value={m}>{MESECI[m]} {m >= 9 ? pocetnaGodina : pocetnaGodina + 1}</option>
              ))}
            </select>
          </div>
          <button onClick={izvezi} style={{ ...stilInput, width: 'auto', cursor: 'pointer', fontWeight: 500 }}>Izvezi u Excel</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 100, background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: boja.meki }}>Prihodi</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: boja.uspeh }}>{formatRSD(ukupniPrihodi)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 100, background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: boja.meki }}>Rashodi</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: boja.greska }}>{formatRSD(rashodi)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 100, background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: boja.meki }}>Saldo</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: saldo >= 0 ? boja.uspeh : boja.greska }}>{formatRSD(saldo)}</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: boja.meki, marginTop: 0 }}>
          Od prihoda, članarine: {formatRSD(clanarine)} · ostali prihodi: {formatRSD(ostaliPrihodi)}
        </p>

        <div style={{ background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 12, padding: 14, marginTop: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nova transakcija</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={stilLabela}>Tip</label>
              <select style={stilInput} value={tip} onChange={(e) => { setTip(e.target.value as any); setKategorija('') }}>
                <option value="rashod">Rashod</option>
                <option value="prihod">Prihod</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={stilLabela}>Iznos (RSD)</label>
              <input style={stilInput} value={iznos} onChange={(e) => setIznos(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={stilLabela}>Kategorija</label>
              <select style={stilInput} value={kategorija} onChange={(e) => setKategorija(e.target.value)}>
                <option value="">— izaberi —</option>
                {KATEGORIJE[tip].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={stilLabela}>Datum</label>
              <input type="date" style={stilInput} value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={stilLabela}>Opis (opciono)</label>
            <input style={stilInput} value={opis} onChange={(e) => setOpis(e.target.value)} />
          </div>
          <button onClick={dodaj} disabled={radi} style={{ width: '100%', background: boja.akcenat, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 15, fontWeight: 600, cursor: radi ? 'default' : 'pointer', opacity: radi ? 0.6 : 1 }}>
            {radi ? 'Čuvam...' : 'Dodaj transakciju'}
          </button>
          {poruka && (
            <p style={{ fontSize: 14, color: poruka.tip === 'greska' ? boja.greska : boja.uspeh, marginBottom: 0 }}>{poruka.tekst}</p>
          )}
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 8px' }}>Transakcije ({transakcije.length})</h2>
        {transakcije.length === 0 ? (
          <p style={{ color: boja.meki, fontSize: 14 }}>Nema ručno unetih transakcija za ovaj period.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transakcije.map((t) => {
              const prihod = t.tip === 'prihod'
              return (
                <div key={t.id} style={{ background: boja.karta, border: `1px solid ${boja.ivica}`, borderLeft: `3px solid ${prihod ? boja.uspeh : boja.greska}`, borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {t.kategorija ?? (prihod ? 'Prihod' : 'Rashod')}
                    </div>
                    <div style={{ fontSize: 12, color: boja.meki }}>
                      {formatDatum(t.datum)}{t.opis ? ` · ${t.opis}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 600, color: prihod ? boja.uspeh : boja.greska }}>
                      {prihod ? '+' : '−'}{formatRSD(Number(t.iznos))}
                    </div>
                    <button onClick={() => obrisi(t.id)} style={{ border: 'none', background: 'none', color: boja.greska, cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
