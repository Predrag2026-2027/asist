import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

type Grupa = { id: string; naziv: string; tip: string; uzrast_oznaka: string | null }
type Red = { ime: string; prisutan: number; odrzano: number; pct: number }

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

function labelaGrupe(g?: Grupa): string {
  if (!g) return ''
  return g.uzrast_oznaka ? `${g.naziv} ${g.uzrast_oznaka}` : g.naziv
}

function bojaPct(p: number): string {
  if (p >= 75) return boja.uspeh
  if (p >= 50) return '#BA7517'
  return boja.greska
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
      .from('treninzi')
      .select('id')
      .eq('sezona_id', sezonaId)
      .eq('grupa_id', grupaId)
      .eq('status', 'odrzan')
    const heldIds = ((held as any[]) ?? []).map((t) => t.id)
    setOdrzano(heldIds.length)

    const { data: cl } = await supabase
      .from('clanstvo')
      .select('clan_id')
      .eq('grupa_id', grupaId)
      .eq('sezona_id', sezonaId)
      .is('datum_do', null)
    const childIds = [...new Set(((cl as any[]) ?? []).map((x) => x.clan_id))]

    let clanovi: { id: string; ime: string }[] = []
    if (childIds.length) {
      const { data: c } = await supabase.from('clanovi').select('id, ime').in('id', childIds).eq('status', 'aktivan').order('ime')
      clanovi = (c as any) ?? []
    }

    const brojPrisutnih: Record<string, number> = {}
    if (heldIds.length) {
      const { data: pr } = await supabase
        .from('prisustvo')
        .select('clan_id')
        .in('trening_id', heldIds)
        .eq('prisutan', true)
        .range(0, 9999)
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
    const podaci = redovi.map((r) => ({
      Dete: r.ime,
      Prisutan: r.prisutan,
      Održano: r.odrzano,
      'Procenat (%)': r.pct,
    }))
    const ws = XLSX.utils.json_to_sheet(podaci)
    ws['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Prisustvo')
    XLSX.writeFile(wb, `Prisustvo_${labelaGrupe(g).replace(/[\/\\ ]/g, '_')}.xlsx`)
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: boja.pozadina, color: boja.tekst, minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 2px' }}>Statistika prisustva</h1>
        <p style={{ color: boja.meki, marginTop: 0, fontSize: 14 }}>Na osnovu održanih treninga · sezona 2026/2027</p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', margin: '12px 0' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 13, color: boja.meki, marginBottom: 4 }}>Grupa</label>
            <select style={stilInput} value={grupaId} onChange={(e) => setGrupaId(e.target.value)}>
              {grupe.map((g) => (
                <option key={g.id} value={g.id}>{labelaGrupe(g)}</option>
              ))}
            </select>
          </div>
          <button onClick={izvezi} style={{ ...stilInput, width: 'auto', cursor: 'pointer', fontWeight: 500 }}>Izvezi u Excel</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: boja.meki }}>Održanih treninga</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{odrzano}</div>
          </div>
          <div style={{ flex: 1, background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: boja.meki }}>Prosečna posećenost</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: bojaPct(prosek) }}>{prosek}%</div>
          </div>
        </div>

        {ucitava ? (
          <p style={{ color: boja.meki, fontSize: 14 }}>Računam...</p>
        ) : odrzano === 0 ? (
          <p style={{ color: boja.meki, fontSize: 14 }}>Za ovu grupu još nema treninga označenih kao „održan". Označi treninge na kalendaru da bi statistika imala osnovu.</p>
        ) : redovi.length === 0 ? (
          <p style={{ color: boja.meki, fontSize: 14 }}>Grupa nema aktivnih članova.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {redovi.map((r, i) => (
              <div key={i} style={{ background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>{r.ime}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: bojaPct(r.pct) }}>
                    {r.pct}% <span style={{ color: boja.meki, fontWeight: 400, fontSize: 13 }}>({r.prisutan}/{r.odrzano})</span>
                  </div>
                </div>
                <div style={{ height: 6, background: boja.pozadina, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${r.pct}%`, height: '100%', background: bojaPct(r.pct) }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
