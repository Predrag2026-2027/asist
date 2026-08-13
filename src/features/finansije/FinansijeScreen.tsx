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
type MesecPodatak = { mesec: number; godina: number; prihodi: number; rashodi: number }

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
const MESECI_KRATKO: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'Maj', 6: 'Jun',
  7: 'Jul', 8: 'Avg', 9: 'Sep', 10: 'Okt', 11: 'Nov', 12: 'Dec',
}
const KATEGORIJE: Record<string, string[]> = {
  prihod: ['Donacija', 'Sponzorstvo', 'Kotizacija', 'Ostalo'],
  rashod: ['Zakup hale', 'Sudije', 'Oprema', 'Honorari', 'Kotizacije/takse', 'Putovanja', 'Ostalo'],
}
const REDOSLED = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]

function formatRSD(n: number): string {
  return new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 0 }).format(n) + ' RSD'
}
function kompakt(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'k'
  return String(Math.round(n))
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
const kartaStil: React.CSSProperties = { background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 12, padding: 14, marginTop: 12 }

export default function FinansijeScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [datumOd, setDatumOd] = useState('')
  const [datumDo, setDatumDo] = useState('')
  const [pocetnaGodina, setPocetnaGodina] = useState(new Date().getFullYear())
  const [period, setPeriod] = useState('sezona')
  const [transakcije, setTransakcije] = useState<Transakcija[]>([])
  const [clanarine, setClanarine] = useState(0)
  const [mesecni, setMesecni] = useState<MesecPodatak[]>([])
  const [poruka, setPoruka] = useState<{ tip: 'greska' | 'uspeh'; tekst: string } | null>(null)
  const [radi, setRadi] = useState(false)

  const [tip, setTip] = useState<'prihod' | 'rashod'>('rashod')
  const [kategorija, setKategorija] = useState('')
  const [iznos, setIznos] = useState('')
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10))
  const [opis, setOpis] = useState('')

  const meseci = REDOSLED

  function rasponPerioda(): { od: string; do: string } {
    if (period === 'sezona') return { od: datumOd, do: datumDo }
    const m = Number(period)
    const g = m >= 9 ? pocetnaGodina : pocetnaGodina + 1
    const od = `${g}-${String(m).padStart(2, '0')}-01`
    const poslednji = new Date(g, m, 0).getDate()
    return { od, do: `${g}-${String(m).padStart(2, '0')}-${poslednji}` }
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
      .range(0, 9999)
    setClanarine(((up as any[]) ?? []).reduce((s, u) => s + Number(u.iznos), 0))
  }

  async function ucitajSezonu() {
    if (!sezonaId) return
    const py = pocetnaGodina
    const prihodiMap: Record<number, number> = {}
    const rashodiMap: Record<number, number> = {}

    const { data: up } = await supabase
      .from('uplate')
      .select('iznos, datum, zaduzenja!inner(sezona_id)')
      .eq('zaduzenja.sezona_id', sezonaId)
      .range(0, 9999)
    for (const u of (up as any[]) ?? []) {
      const m = Number((u.datum as string).slice(5, 7))
      prihodiMap[m] = (prihodiMap[m] ?? 0) + Number(u.iznos)
    }
    const { data: tr } = await supabase
      .from('finansije_transakcije')
      .select('tip, iznos, datum')
      .eq('sezona_id', sezonaId)
      .range(0, 9999)
    for (const t of (tr as any[]) ?? []) {
      const m = Number((t.datum as string).slice(5, 7))
      if (t.tip === 'prihod') prihodiMap[m] = (prihodiMap[m] ?? 0) + Number(t.iznos)
      else rashodiMap[m] = (rashodiMap[m] ?? 0) + Number(t.iznos)
    }
    setMesecni(
      REDOSLED.map((m) => ({
        mesec: m,
        godina: m >= 9 ? py : py + 1,
        prihodi: prihodiMap[m] ?? 0,
        rashodi: rashodiMap[m] ?? 0,
      }))
    )
  }

  useEffect(() => {
    ucitajOsnovu()
  }, [])
  useEffect(() => {
    if (sezonaId) {
      ucitaj()
      ucitajSezonu()
    }
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
        sezona_id: sezonaId, tip, kategorija: kategorija || null, iznos: suma, datum, opis: opis.trim() || null,
      })
      if (error) throw error
      setIznos('')
      setOpis('')
      setKategorija('')
      setPoruka({ tip: 'uspeh', tekst: 'Transakcija dodata.' })
      await ucitaj()
      await ucitajSezonu()
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) })
    } finally {
      setRadi(false)
    }
  }

  async function obrisi(id: string) {
    if (!window.confirm('Obrisati ovu transakciju?')) return
    const { error } = await supabase.from('finansije_transakcije').delete().eq('id', id)
    if (!error) {
      await ucitaj()
      await ucitajSezonu()
    }
  }

  const ostaliPrihodi = transakcije.filter((t) => t.tip === 'prihod').reduce((s, t) => s + Number(t.iznos), 0)
  const rashodi = transakcije.filter((t) => t.tip === 'rashod').reduce((s, t) => s + Number(t.iznos), 0)
  const ukupniPrihodi = clanarine + ostaliPrihodi
  const saldo = ukupniPrihodi - rashodi

  const rashodiPoKat: Record<string, number> = {}
  for (const t of transakcije) if (t.tip === 'rashod') rashodiPoKat[t.kategorija || 'Ostalo'] = (rashodiPoKat[t.kategorija || 'Ostalo'] ?? 0) + Number(t.iznos)
  const katLista = Object.entries(rashodiPoKat).sort((a, b) => b[1] - a[1])
  const maxKat = katLista.length ? katLista[0][1] : 0

  const maxMesecni = Math.max(1, ...mesecni.map((m) => Math.max(m.prihodi, m.rashodi)))

  function izvezi() {
    const labelP = period === 'sezona' ? 'Cela_sezona' : MESECI[Number(period)]
    const podaci = [
      { Stavka: 'Članarine (uplate)', Iznos: clanarine },
      { Stavka: 'Ostali prihodi', Iznos: ostaliPrihodi },
      { Stavka: 'Rashodi', Iznos: -rashodi },
      { Stavka: 'SALDO', Iznos: saldo },
      {},
      ...transakcije.map((t) => ({
        Datum: formatDatum(t.datum), Tip: t.tip === 'prihod' ? 'Prihod' : 'Rashod',
        Kategorija: t.kategorija ?? '', Opis: t.opis ?? '',
        Iznos: t.tip === 'rashod' ? -Number(t.iznos) : Number(t.iznos),
      })),
    ]
    const ws = XLSX.utils.json_to_sheet(podaci)
    ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 18 }, { wch: 24 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Finansije')
    XLSX.writeFile(wb, `Finansije_${labelP}.xlsx`)
  }

  const W = 700, H = 240, top = 12, bottom = 34, plot = H - top - bottom
  const grupa = W / 12
  const barW = grupa * 0.32
  const prihodiUkupnoStruktura = clanarine + ostaliPrihodi

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: boja.pozadina, color: boja.tekst, minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 2px' }}>Finansije kluba</h1>
        <p style={{ color: boja.meki, marginTop: 0, fontSize: 14 }}>Sezona 2026/2027</p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', margin: '12px 0' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={stilLabela}>Period (za rezime i strukturu rashoda)</label>
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

        <div style={kartaStil}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Kroz sezonu — prihodi i rashodi</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <span style={{ color: boja.uspeh }}>■ Prihodi</span>
              <span style={{ color: boja.greska }}>■ Rashodi</span>
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1={0} y1={top + plot - plot * f} x2={W} y2={top + plot - plot * f} stroke={boja.ivica} strokeWidth={1} />
            ))}
            {mesecni.map((m, i) => {
              const x0 = i * grupa + (grupa - barW * 2 - 4) / 2
              const hP = (m.prihodi / maxMesecni) * plot
              const hR = (m.rashodi / maxMesecni) * plot
              return (
                <g key={m.mesec}>
                  <rect x={x0} y={top + plot - hP} width={barW} height={hP} rx={2} fill={boja.uspeh}>
                    <title>{MESECI[m.mesec]}: prihodi {formatRSD(m.prihodi)}</title>
                  </rect>
                  <rect x={x0 + barW + 4} y={top + plot - hR} width={barW} height={hR} rx={2} fill={boja.greska}>
                    <title>{MESECI[m.mesec]}: rashodi {formatRSD(m.rashodi)}</title>
                  </rect>
                  <text x={i * grupa + grupa / 2} y={H - 12} textAnchor="middle" fontSize={12} fill={boja.meki}>
                    {MESECI_KRATKO[m.mesec]}
                  </text>
                </g>
              )
            })}
            <text x={4} y={top + 4} fontSize={11} fill={boja.meki}>max {kompakt(maxMesecni)}</text>
          </svg>
        </div>

        {prihodiUkupnoStruktura > 0 && (
          <div style={kartaStil}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Struktura prihoda ({period === 'sezona' ? 'sezona' : MESECI[Number(period)]})</div>
            <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: `1px solid ${boja.ivica}` }}>
              <div style={{ width: `${(clanarine / prihodiUkupnoStruktura) * 100}%`, background: boja.uspeh }} />
              <div style={{ width: `${(ostaliPrihodi / prihodiUkupnoStruktura) * 100}%`, background: '#378ADD' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13 }}>
              <span><span style={{ color: boja.uspeh }}>■</span> Članarine: {formatRSD(clanarine)}</span>
              <span><span style={{ color: '#378ADD' }}>■</span> Ostali: {formatRSD(ostaliPrihodi)}</span>
            </div>
          </div>
        )}

        <div style={kartaStil}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Rashodi po kategorijama ({period === 'sezona' ? 'sezona' : MESECI[Number(period)]})</div>
          {katLista.length === 0 ? (
            <p style={{ fontSize: 13, color: boja.meki, margin: 0 }}>Nema rashoda za ovaj period.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {katLista.map(([kat, iz]) => (
                <div key={kat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                    <span>{kat}</span>
                    <span style={{ color: boja.meki }}>{formatRSD(iz)} · {Math.round((iz / rashodi) * 100)}%</span>
                  </div>
                  <div style={{ height: 8, background: boja.pozadina, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(iz / maxKat) * 100}%`, height: '100%', background: boja.akcenat }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={kartaStil}>
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
                {KATEGORIJE[tip].map((k) => (<option key={k} value={k}>{k}</option>))}
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
          {poruka && (<p style={{ fontSize: 14, color: poruka.tip === 'greska' ? boja.greska : boja.uspeh, marginBottom: 0 }}>{poruka.tekst}</p>)}
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
                    <div style={{ fontWeight: 600 }}>{t.kategorija ?? (prihod ? 'Prihod' : 'Rashod')}</div>
                    <div style={{ fontSize: 12, color: boja.meki }}>{formatDatum(t.datum)}{t.opis ? ` · ${t.opis}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 600, color: prihod ? boja.uspeh : boja.greska }}>{prihod ? '+' : '−'}{formatRSD(Number(t.iznos))}</div>
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
