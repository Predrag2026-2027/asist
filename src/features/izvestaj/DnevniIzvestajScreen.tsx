import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { T, dugme } from '../../lib/tema'

type Uplata = { id: string; iznos: number; nacin: string; primioId: string | null; naziv: string }
type Grupa = { primioId: string | null; ime: string; ukupno: number; gotovina: number; transfer: number; stavke: Uplata[] }

function formatRSD(n: number): string { return new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 0 }).format(n) + ' RSD' }
function danasLokalno(): string { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
function formatDatum(d: string): string { const [g, m, dan] = d.split('-'); return `${dan}.${m}.${g}.` }
function pomeriDatum(d: string, delta: number): string {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + delta)
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
function nazivPorodice(por: any): string {
  if (!por) return '—'
  const imena = [...(por.clanovi ?? [])].sort((a: any, b: any) => (a.datum_rodjenja ?? '').localeCompare(b.datum_rodjenja ?? '')).map((d: any) => d.ime)
  return imena.length ? `${por.prezime} (${imena.join(', ')})` : por.prezime
}

const karta: React.CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 16, padding: 16 }

export default function DnevniIzvestajScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [datum, setDatum] = useState(danasLokalno())
  const [grupe, setGrupe] = useState<Grupa[]>([])
  const [ukupno, setUkupno] = useState(0)
  const [gotovina, setGotovina] = useState(0)
  const [transfer, setTransfer] = useState(0)
  const [ucitava, setUcitava] = useState(false)
  const [otvoreni, setOtvoreni] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: sez } = await supabase.from('sezone').select('id').eq('aktivna', true).maybeSingle()
      setSezonaId((sez as any)?.id ?? null)
    })()
  }, [])

  useEffect(() => {
    if (sezonaId) ucitaj()
  }, [sezonaId, datum])

  async function ucitaj() {
    if (!sezonaId) return
    setUcitava(true)
    setOtvoreni(null)
    const { data: tr } = await supabase.from('treneri').select('id, ime')
    const trenerMap = new Map(((tr as any[]) ?? []).map((t) => [t.id, t.ime]))

    const { data } = await supabase
      .from('uplate')
      .select('id, iznos, nacin, primio_trener_id, datum, zaduzenja!inner(sezona_id, porodice(prezime, clanovi(ime, datum_rodjenja)))')
      .eq('datum', datum)
      .eq('zaduzenja.sezona_id', sezonaId)
      .range(0, 9999)

    const redovi = (data as any[]) ?? []
    let uk = 0, got = 0, tra = 0
    const mapa = new Map<string, Grupa>()
    for (const r of redovi) {
      const iznos = Number(r.iznos)
      uk += iznos
      const jeGotovina = r.nacin !== 'transfer'
      if (jeGotovina) got += iznos
      else tra += iznos
      const pid = r.primio_trener_id ?? null
      const kljuc = pid ?? '__nepoznat__'
      let g = mapa.get(kljuc)
      if (!g) {
        g = { primioId: pid, ime: pid ? (trenerMap.get(pid) ?? 'Nepoznat trener') : 'Nije naznačeno', ukupno: 0, gotovina: 0, transfer: 0, stavke: [] }
        mapa.set(kljuc, g)
      }
      g.ukupno += iznos
      if (jeGotovina) g.gotovina += iznos
      else g.transfer += iznos
      g.stavke.push({ id: r.id, iznos, nacin: r.nacin ?? 'gotovina', primioId: pid, naziv: nazivPorodice(r.zaduzenja?.porodice) })
    }
    const lista = [...mapa.values()].sort((a, b) => b.gotovina - a.gotovina)
    setGrupe(lista)
    setUkupno(uk)
    setGotovina(got)
    setTransfer(tra)
    setUcitava(false)
  }

  function izvezi() {
    const podaci: any[] = [
      { A: 'Dnevni izveštaj uplata', B: formatDatum(datum) },
      {},
      { A: 'Ukupno', B: ukupno },
      { A: 'Gotovina', B: gotovina },
      { A: 'Na račun', B: transfer },
      {},
      { A: 'Trener', B: 'Porodica', C: 'Iznos', D: 'Način' },
    ]
    for (const g of grupe) {
      for (const s of g.stavke) {
        podaci.push({ A: g.ime, B: s.naziv, C: s.iznos, D: s.nacin === 'transfer' ? 'račun' : 'gotovina' })
      }
      podaci.push({ A: `UKUPNO ${g.ime}`, C: g.ukupno, D: `gotovina ${g.gotovina}` })
      podaci.push({})
    }
    const ws = XLSX.utils.json_to_sheet(podaci, { skipHeader: true })
    ws['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 14 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Uplate')
    XLSX.writeFile(wb, `Uplate_${datum}.xlsx`)
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>Dnevni izveštaj uplata</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Ko je koliko primio — za razduživanje gotovine.</div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => setDatum(pomeriDatum(datum, -1))} style={dugme('ghost-black', 'sm')}>‹</button>
        <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} style={{ height: 40, padding: '0 12px', border: `1px solid ${T.boja.edge}`, borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: T.boja.ink, background: '#fff' }} />
        <button onClick={() => setDatum(pomeriDatum(datum, 1))} style={dugme('ghost-black', 'sm')}>›</button>
        <button onClick={() => setDatum(danasLokalno())} style={dugme('outline-black', 'sm')}>Danas</button>
        <button onClick={izvezi} style={{ ...dugme('outline-black', 'sm'), marginLeft: 'auto' }}>Izvezi u Excel</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ ...karta, flex: 1, minWidth: 120, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>Ukupno</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{formatRSD(ukupno)}</div>
        </div>
        <div style={{ ...karta, flex: 1, minWidth: 120, padding: '12px 14px', background: T.boja.greenBg, borderColor: T.boja.greenEdge }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.boja.green700 }}>Gotovina</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: T.boja.green700 }}>{formatRSD(gotovina)}</div>
        </div>
        <div style={{ ...karta, flex: 1, minWidth: 120, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>Na račun</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{formatRSD(transfer)}</div>
        </div>
      </div>

      {ucitava ? (
        <p style={{ color: T.boja.ink500, fontSize: 14, fontWeight: 600 }}>Učitavam...</p>
      ) : grupe.length === 0 ? (
        <p style={{ color: T.boja.ink500, fontSize: 14, fontWeight: 600 }}>Nema evidentiranih uplata za ovaj dan.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grupe.map((g) => {
            const kljuc = g.primioId ?? '__nepoznat__'
            const otvoren = otvoreni === kljuc
            return (
              <div key={kljuc} style={karta}>
                <div onClick={() => setOtvoreni(otvoren ? null : kljuc)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{g.ime}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>{g.stavke.length} {g.stavke.length === 1 ? 'uplata' : 'uplate/a'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.boja.green700 }}>gotovina za razduživanje</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.boja.green700 }}>{formatRSD(g.gotovina)}</div>
                    {g.transfer > 0 && <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>na račun: {formatRSD(g.transfer)}</div>}
                  </div>
                </div>
                {otvoren && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${T.boja.edge}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {g.stavke.map((s) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.naziv}</span>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: s.nacin === 'transfer' ? T.boja.ink500 : T.boja.green700 }}>
                          {formatRSD(s.iznos)} · {s.nacin === 'transfer' ? 'račun' : 'gotovina'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
