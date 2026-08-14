import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { T, dugme, polje, labela } from '../../lib/tema'

type Transakcija = { id: string; tip: string; kategorija: string | null; iznos: number; datum: string; opis: string | null }
type MesecPodatak = { mesec: number; godina: number; prihodi: number; rashodi: number }

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

function formatRSD(n: number): string { return new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 0 }).format(n) + ' RSD' }
function kompakt(n: number): string { if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'; if (n >= 1000) return Math.round(n / 1000) + 'k'; return String(Math.round(n)) }
function formatDatum(d: string): string { const [g, m, dan] = d.split('-'); return `${dan}.${m}.${g}.` }

const karta: React.CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 16, padding: 16 }
const OSTALI = '#378ADD'

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
    const { data: tr } = await supabase.from('finansije_transakcije').select('id, tip, kategorija, iznos, datum, opis').eq('sezona_id', sezonaId).gte('datum', od).lte('datum', do_).order('datum', { ascending: false })
    setTransakcije((tr as any) ?? [])
    const { data: up } = await supabase.from('uplate').select('iznos, datum, zaduzenja!inner(sezona_id)').eq('zaduzenja.sezona_id', sezonaId).gte('datum', od).lte('datum', do_).range(0, 9999)
    setClanarine(((up as any[]) ?? []).reduce((s, u) => s + Number(u.iznos), 0))
  }

  async function ucitajSezonu() {
    if (!sezonaId) return
    const py = pocetnaGodina
    const prihodiMap: Record<number, number> = {}
    const rashodiMap: Record<number, number> = {}
    const { data: up } = await supabase.from('uplate').select('iznos, datum, zaduzenja!inner(sezona_id)').eq('zaduzenja.sezona_id', sezonaId).range(0, 9999)
    for (const u of (up as any[]) ?? []) { const m = Number((u.datum as string).slice(5, 7)); prihodiMap[m] = (prihodiMap[m] ?? 0) + Number(u.iznos) }
    const { data: tr } = await supabase.from('finansije_transakcije').select('tip, iznos, datum').eq('sezona_id', sezonaId).range(0, 9999)
    for (const t of (tr as any[]) ?? []) { const m = Number((t.datum as string).slice(5, 7)); if (t.tip === 'prihod') prihodiMap[m] = (prihodiMap[m] ?? 0) + Number(t.iznos); else rashodiMap[m] = (rashodiMap[m] ?? 0) + Number(t.iznos) }
    setMesecni(REDOSLED.map((m) => ({ mesec: m, godina: m >= 9 ? py : py + 1, prihodi: prihodiMap[m] ?? 0, rashodi: rashodiMap[m] ?? 0 })))
  }

  useEffect(() => { ucitajOsnovu() }, [])
  useEffect(() => { if (sezonaId) { ucitaj(); ucitajSezonu() } }, [sezonaId, period])

  async function dodaj() {
    setPoruka(null)
    const suma = Number(iznos.replace(',', '.'))
    if (!suma || suma <= 0) { setPoruka({ tip: 'greska', tekst: 'Unesi ispravan iznos.' }); return }
    setRadi(true)
    try {
      const { error } = await supabase.from('finansije_transakcije').insert({ sezona_id: sezonaId, tip, kategorija: kategorija || null, iznos: suma, datum, opis: opis.trim() || null })
      if (error) throw error
      setIznos(''); setOpis(''); setKategorija('')
      setPoruka({ tip: 'uspeh', tekst: 'Transakcija dodata.' })
      await ucitaj(); await ucitajSezonu()
    } catch (err: any) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) }) } finally { setRadi(false) }
  }

  async function obrisi(id: string) {
    if (!window.confirm('Obrisati ovu transakciju?')) return
    const { error } = await supabase.from('finansije_transakcije').delete().eq('id', id)
    if (!error) { await ucitaj(); await ucitajSezonu() }
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
      ...transakcije.map((t) => ({ Datum: formatDatum(t.datum), Tip: t.tip === 'prihod' ? 'Prihod' : 'Rashod', Kategorija: t.kategorija ?? '', Opis: t.opis ?? '', Iznos: t.tip === 'rashod' ? -Number(t.iznos) : Number(t.iznos) })),
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
  const labelPeriod = period === 'sezona' ? 'sezona' : MESECI[Number(period)]

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>Finansije kluba</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Sezona 2026/2027</div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={labela}>Period (za rezime i strukturu rashoda)</label>
          <select style={polje} value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="sezona">Cela sezona</option>
            {meseci.map((m) => (<option key={m} value={m}>{MESECI[m]} {m >= 9 ? pocetnaGodina : pocetnaGodina + 1}</option>))}
          </select>
        </div>
        <button onClick={izvezi} style={dugme('outline-black', 'md')}>Izvezi u Excel</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ ...karta, flex: 1, minWidth: 110, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>Prihodi</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.boja.green700, marginTop: 2 }}>{formatRSD(ukupniPrihodi)}</div>
        </div>
        <div style={{ ...karta, flex: 1, minWidth: 110, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>Rashodi</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.boja.red, marginTop: 2 }}>{formatRSD(rashodi)}</div>
        </div>
        <div style={{ ...karta, flex: 1, minWidth: 110, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>Saldo</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: saldo >= 0 ? T.boja.green700 : T.boja.red, marginTop: 2 }}>{formatRSD(saldo)}</div>
        </div>
      </div>

      <div style={{ ...karta, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Kroz sezonu — prihodi i rashodi</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 700 }}>
            <span style={{ color: T.boja.green700 }}>■ Prihodi</span>
            <span style={{ color: T.boja.red }}>■ Rashodi</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          {[0.25, 0.5, 0.75, 1].map((f) => (<line key={f} x1={0} y1={top + plot - plot * f} x2={W} y2={top + plot - plot * f} stroke={T.boja.edge} strokeWidth={1} />))}
          {mesecni.map((m, i) => {
            const x0 = i * grupa + (grupa - barW * 2 - 4) / 2
            const hP = (m.prihodi / maxMesecni) * plot
            const hR = (m.rashodi / maxMesecni) * plot
            return (
              <g key={m.mesec}>
                <rect x={x0} y={top + plot - hP} width={barW} height={hP} rx={2} fill={T.boja.green}><title>{MESECI[m.mesec]}: prihodi {formatRSD(m.prihodi)}</title></rect>
                <rect x={x0 + barW + 4} y={top + plot - hR} width={barW} height={hR} rx={2} fill={T.boja.red}><title>{MESECI[m.mesec]}: rashodi {formatRSD(m.rashodi)}</title></rect>
                <text x={i * grupa + grupa / 2} y={H - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill={T.boja.ink500}>{MESECI_KRATKO[m.mesec]}</text>
              </g>
            )
          })}
          <text x={4} y={top + 4} fontSize={11} fontWeight={700} fill={T.boja.ink500}>max {kompakt(maxMesecni)}</text>
        </svg>
      </div>

      {prihodiUkupnoStruktura > 0 && (
        <div style={{ ...karta, marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Struktura prihoda ({labelPeriod})</div>
          <div style={{ display: 'flex', height: 22, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.boja.edge}` }}>
            <div style={{ width: `${(clanarine / prihodiUkupnoStruktura) * 100}%`, background: T.boja.green }} />
            <div style={{ width: `${(ostaliPrihodi / prihodiUkupnoStruktura) * 100}%`, background: OSTALI }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, fontWeight: 600 }}>
            <span><span style={{ color: T.boja.green }}>■</span> Članarine: {formatRSD(clanarine)}</span>
            <span><span style={{ color: OSTALI }}>■</span> Ostali: {formatRSD(ostaliPrihodi)}</span>
          </div>
        </div>
      )}

      <div style={{ ...karta, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Rashodi po kategorijama ({labelPeriod})</div>
        {katLista.length === 0 ? (
          <p style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500, margin: 0 }}>Nema rashoda za ovaj period.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {katLista.map(([kat, iz]) => (
              <div key={kat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
                  <span>{kat}</span>
                  <span style={{ color: T.boja.ink500 }}>{formatRSD(iz)} · {Math.round((iz / rashodi) * 100)}%</span>
                </div>
                <div style={{ height: 8, background: T.boja.fill, borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${(iz / maxKat) * 100}%`, height: '100%', background: T.boja.brand }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...karta, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Nova transakcija</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labela}>Tip</label>
            <select style={polje} value={tip} onChange={(e) => { setTip(e.target.value as any); setKategorija('') }}>
              <option value="rashod">Rashod</option>
              <option value="prihod">Prihod</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labela}>Iznos (RSD)</label>
            <input style={polje} value={iznos} onChange={(e) => setIznos(e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labela}>Kategorija</label>
            <select style={polje} value={kategorija} onChange={(e) => setKategorija(e.target.value)}>
              <option value="">— izaberi —</option>
              {KATEGORIJE[tip].map((k) => (<option key={k} value={k}>{k}</option>))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labela}>Datum</label>
            <input type="date" style={polje} value={datum} onChange={(e) => setDatum(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labela}>Opis (opciono)</label>
          <input style={polje} value={opis} onChange={(e) => setOpis(e.target.value)} />
        </div>
        <button onClick={dodaj} disabled={radi} style={{ ...dugme('brand', 'md'), width: '100%', opacity: radi ? 0.6 : 1 }}>
          {radi ? 'Čuvam...' : 'Dodaj transakciju'}
        </button>
        {poruka && (<p style={{ fontSize: 14, fontWeight: 700, color: poruka.tip === 'greska' ? T.boja.red : T.boja.green700, marginBottom: 0 }}>{poruka.tekst}</p>)}
      </div>

      <div style={{ fontSize: 16, fontWeight: 800, margin: '4px 0 8px' }}>Transakcije ({transakcije.length})</div>
      {transakcije.length === 0 ? (
        <p style={{ color: T.boja.ink500, fontSize: 14, fontWeight: 600 }}>Nema ručno unetih transakcija za ovaj period.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {transakcije.map((t) => {
            const prihod = t.tip === 'prihod'
            return (
              <div key={t.id} style={{ background: '#fff', border: `1px solid ${T.boja.edge}`, borderLeft: `3px solid ${prihod ? T.boja.green : T.boja.red}`, borderRadius: 14, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{t.kategorija ?? (prihod ? 'Prihod' : 'Rashod')}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>{formatDatum(t.datum)}{t.opis ? ` · ${t.opis}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontWeight: 800, color: prihod ? T.boja.green700 : T.boja.red }}>{prihod ? '+' : '−'}{formatRSD(Number(t.iznos))}</div>
                  <button onClick={() => obrisi(t.id)} style={{ border: 'none', background: 'none', color: T.boja.red, cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
