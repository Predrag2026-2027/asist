import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { T, dugme, pragBoja } from '../../lib/tema'

type Grupa = { id: string; naziv: string; tip: string; uzrast_oznaka: string | null }
type Red = { ime: string; prisutan: number; odrzano: number; pct: number }

function labelaGrupe(g?: Grupa): string {
  if (!g) return ''
  return g.uzrast_oznaka ? `${g.naziv} ${g.uzrast_oznaka}` : g.naziv
}

const karta: React.CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 16, padding: '14px 16px' }

export default function StatistikaScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [grupe, setGrupe] = useState<Grupa[]>([])
  const [grupaId, setGrupaId] = useState('')
  const [redovi, setRedovi] = useState<Red[]>([])
  const [odrzano, setOdrzano] = useState(0)
  const [ucitava, setUcitava] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: sez } = await supabase.from('sezone').select('id').eq('aktivna', true).maybeSingle()
      const sid = (sez as any)?.id ?? null
      setSezonaId(sid)
      if (sid) {
        const { data: g } = await supabase.from('grupe').select('id, naziv, tip, uzrast_oznaka').eq('sezona_id', sid).order('tip').order('naziv')
        const lista = (g as any as Grupa[]) ?? []
        setGrupe(lista)
        if (lista.length) setGrupaId(lista[0].id)
      }
    })()
  }, [])

  useEffect(() => {
    if (grupaId && sezonaId) izracunaj()
  }, [grupaId, sezonaId])

  async function izracunaj() {
    setUcitava(true)
    const { data: held } = await supabase
      .from('treninzi').select('id').eq('sezona_id', sezonaId).eq('grupa_id', grupaId).eq('status', 'odrzan')
    const heldIds = ((held as any[]) ?? []).map((t) => t.id)
    setOdrzano(heldIds.length)

    const { data: cl } = await supabase.from('clanstvo').select('clan_id').eq('grupa_id', grupaId).eq('sezona_id', sezonaId).is('datum_do', null)
    const childIds = [...new Set(((cl as any[]) ?? []).map((x) => x.clan_id))]

    let clanovi: { id: string; ime: string }[] = []
    if (childIds.length) {
      const { data: c } = await supabase.from('clanovi').select('id, ime').in('id', childIds).eq('status', 'aktivan').order('ime')
      clanovi = (c as any) ?? []
    }

    const brojPrisutnih: Record<string, number> = {}
    if (heldIds.length) {
      const { data: pr } = await supabase.from('prisustvo').select('clan_id').in('trening_id', heldIds).eq('prisutan', true).range(0, 9999)
      for (const r of (pr as any[]) ?? []) brojPrisutnih[r.clan_id] = (brojPrisutnih[r.clan_id] ?? 0) + 1
    }

    const red: Red[] = clanovi.map((c) => {
      const prisutan = brojPrisutnih[c.id] ?? 0
      const pct = heldIds.length ? Math.round((prisutan / heldIds.length) * 100) : 0
      return { ime: c.ime, prisutan, odrzano: heldIds.length, pct }
    })
    red.sort((a, b) => a.pct - b.pct)
    setRedovi(red)
    setUcitava(false)
  }

  const prosek = redovi.length ? Math.round(redovi.reduce((s, r) => s + r.pct, 0) / redovi.length) : 0

  function izvezi() {
    const g = grupe.find((x) => x.id === grupaId)
    const podaci = redovi.map((r) => ({ Dete: r.ime, Prisutan: r.prisutan, 'Održano': r.odrzano, 'Procenat (%)': r.pct }))
    const ws = XLSX.utils.json_to_sheet(podaci)
    ws['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Prisustvo')
    XLSX.writeFile(wb, `Prisustvo_${labelaGrupe(g).replace(/[\/\\ ]/g, '_')}.xlsx`)
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>Statistika prisustva</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Na osnovu održanih treninga · sezona 2026/2027</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {grupe.map((g) => {
          const a = g.id === grupaId
          return (
            <button key={g.id} onClick={() => setGrupaId(g.id)} style={{ fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 99, cursor: 'pointer', border: `1px solid ${a ? T.boja.ink : T.boja.edge}`, background: a ? T.boja.ink : '#fff', color: a ? '#fff' : T.boja.ink600 }}>
              {labelaGrupe(g)}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ ...karta, flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>Održanih treninga</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>{odrzano}</div>
        </div>
        <div style={{ ...karta, flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>Prosečna posećenost</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2, color: pragBoja(prosek) }}>{prosek}%</div>
        </div>
        <button onClick={izvezi} style={{ ...dugme('outline-black', 'md'), alignSelf: 'flex-end' }}>Izvezi u Excel</button>
      </div>

      {ucitava ? (
        <p style={{ color: T.boja.ink500, fontSize: 14, fontWeight: 600 }}>Računam...</p>
      ) : odrzano === 0 ? (
        <p style={{ color: T.boja.ink500, fontSize: 14, fontWeight: 600 }}>Za ovu grupu još nema treninga označenih kao „održan". Označi treninge na kalendaru da bi statistika imala osnovu.</p>
      ) : redovi.length === 0 ? (
        <p style={{ color: T.boja.ink500, fontSize: 14, fontWeight: 600 }}>Grupa nema aktivnih članova.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {redovi.map((r, i) => (
            <div key={i} style={{ ...karta, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r.ime}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: pragBoja(r.pct) }}>
                  {r.pct}% <span style={{ color: T.boja.ink500, fontWeight: 600 }}>({r.prisutan}/{r.odrzano})</span>
                </div>
              </div>
              <div style={{ height: 8, background: T.boja.fill, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${r.pct}%`, height: '100%', background: pragBoja(r.pct) }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
