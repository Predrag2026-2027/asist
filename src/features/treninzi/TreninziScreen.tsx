import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Grupa = { id: string; naziv: string; tip: string; uzrast_oznaka: string | null }
type Dete = { id: string; ime: string; datum_rodjenja: string | null }

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

function danas(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function labelaGrupe(g: Grupa): string {
  return g.uzrast_oznaka ? `${g.naziv} ${g.uzrast_oznaka}` : g.naziv
}

const stilInput: React.CSSProperties = {
  padding: '8px 10px',
  border: `1px solid ${boja.ivica}`,
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
  background: '#fff',
  color: boja.tekst,
}

export default function TreninziScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [grupe, setGrupe] = useState<Grupa[]>([])
  const [grupaId, setGrupaId] = useState('')
  const [datum, setDatum] = useState(danas())
  const [deca, setDeca] = useState<Dete[]>([])
  const [prisutni, setPrisutni] = useState<Set<string>>(new Set())
  const [treningId, setTreningId] = useState<string | null>(null)
  const [ucitava, setUcitava] = useState(false)
  const [radi, setRadi] = useState(false)
  const [poruka, setPoruka] = useState<{ tip: 'greska' | 'uspeh'; tekst: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: sez } = await supabase.from('sezone').select('id').eq('aktivna', true).maybeSingle()
      const sid = (sez as any)?.id ?? null
      setSezonaId(sid)
      if (sid) {
        const { data: g } = await supabase
          .from('grupe')
          .select('id, naziv, tip, uzrast_oznaka')
          .eq('sezona_id', sid)
          .order('tip')
          .order('naziv')
        setGrupe((g as any) ?? [])
      }
    })()
  }, [])

  useEffect(() => {
    if (grupaId && datum && sezonaId) ucitajTrening()
    else {
      setDeca([])
      setPrisutni(new Set())
      setTreningId(null)
    }
  }, [grupaId, datum, sezonaId])

  async function ucitajTrening() {
    setUcitava(true)
    setPoruka(null)

    const { data: cl } = await supabase
      .from('clanstvo')
      .select('clan_id')
      .eq('grupa_id', grupaId)
      .eq('sezona_id', sezonaId)
      .is('datum_do', null)
    const ids = [...new Set(((cl as any[]) ?? []).map((x) => x.clan_id))]

    let decaList: Dete[] = []
    if (ids.length) {
      const { data: c } = await supabase
        .from('clanovi')
        .select('id, ime, datum_rodjenja')
        .in('id', ids)
        .eq('status', 'aktivan')
        .order('ime')
      decaList = (c as any) ?? []
    }
    setDeca(decaList)

    const { data: t } = await supabase
      .from('treninzi')
      .select('id')
      .eq('grupa_id', grupaId)
      .eq('datum', datum)
      .maybeSingle()

    if ((t as any)?.id) {
      const tid = (t as any).id
      setTreningId(tid)
      const { data: pr } = await supabase.from('prisustvo').select('clan_id, prisutan').eq('trening_id', tid)
      const present = new Set<string>()
      const marked = new Set<string>()
      for (const r of (pr as any[]) ?? []) {
        marked.add(r.clan_id)
        if (r.prisutan) present.add(r.clan_id)
      }
      for (const d of decaList) if (!marked.has(d.id)) present.add(d.id)
      setPrisutni(present)
    } else {
      setTreningId(null)
      setPrisutni(new Set(decaList.map((d) => d.id)))
    }
    setUcitava(false)
  }

  function toggle(id: string) {
    const s = new Set(prisutni)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setPrisutni(s)
  }

  async function sacuvaj() {
    if (!grupaId || !sezonaId) return
    setRadi(true)
    setPoruka(null)
    try {
      let tid = treningId
      if (!tid) {
        const { data, error } = await supabase
          .from('treninzi')
          .upsert({ grupa_id: grupaId, sezona_id: sezonaId, datum }, { onConflict: 'grupa_id,datum' })
          .select('id')
          .single()
        if (error) throw error
        tid = (data as any).id
        setTreningId(tid)
      }
      const arr = deca.map((d) => ({ trening_id: tid, clan_id: d.id, prisutan: prisutni.has(d.id) }))
      if (arr.length) {
        const { error } = await supabase.from('prisustvo').upsert(arr, { onConflict: 'trening_id,clan_id' })
        if (error) throw error
      }
      setPoruka({ tip: 'uspeh', tekst: `Prisustvo sačuvano (${prisutni.size} od ${deca.length}).` })
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) })
    } finally {
      setRadi(false)
    }
  }

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
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 2px' }}>Treninzi i prisustvo</h1>
        <p style={{ color: boja.meki, marginTop: 0, fontSize: 14 }}>Sezona 2026/2027</p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: 13, color: boja.meki, marginBottom: 4 }}>Grupa</label>
            <select style={{ ...stilInput, width: '100%' }} value={grupaId} onChange={(e) => setGrupaId(e.target.value)}>
              <option value="">— izaberi grupu —</option>
              {grupe.map((g) => (
                <option key={g.id} value={g.id}>
                  {labelaGrupe(g)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: 13, color: boja.meki, marginBottom: 4 }}>Datum</label>
            <input type="date" style={{ ...stilInput, width: '100%' }} value={datum} onChange={(e) => setDatum(e.target.value)} />
          </div>
        </div>

        {!grupaId ? (
          <p style={{ color: boja.meki, fontSize: 14 }}>Izaberi grupu da vidiš spisak dece.</p>
        ) : ucitava ? (
          <p style={{ color: boja.meki, fontSize: 14 }}>Učitavam...</p>
        ) : deca.length === 0 ? (
          <p style={{ color: boja.meki, fontSize: 14 }}>Ova grupa nema upisane aktivne članove.</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                Prisutno: {prisutni.size} / {deca.length}
                {treningId ? ' · trening postoji' : ' · novi trening'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setPrisutni(new Set(deca.map((d) => d.id)))} style={dugmeMalo}>Svi</button>
                <button onClick={() => setPrisutni(new Set())} style={dugmeMalo}>Niko</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {deca.map((d) => {
                const prisutan = prisutni.has(d.id)
                return (
                  <button
                    key={d.id}
                    onClick={() => toggle(d.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      background: prisutan ? '#f0f7f0' : boja.karta,
                      border: `1px solid ${prisutan ? boja.uspeh : boja.ivica}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      color: boja.tekst,
                      fontSize: 15,
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: `1px solid ${prisutan ? boja.uspeh : boja.ivica}`,
                        background: prisutan ? boja.uspeh : '#fff',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {prisutan ? '✓' : ''}
                    </span>
                    {d.ime}
                  </button>
                )
              })}
            </div>

            {poruka && (
              <p style={{ fontSize: 14, color: poruka.tip === 'greska' ? boja.greska : boja.uspeh, marginTop: 12 }}>
                {poruka.tekst}
              </p>
            )}

            <button
              onClick={sacuvaj}
              disabled={radi}
              style={{
                marginTop: 12,
                width: '100%',
                background: boja.akcenat,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 15,
                fontWeight: 600,
                cursor: radi ? 'default' : 'pointer',
                opacity: radi ? 0.6 : 1,
              }}
            >
              {radi ? 'Čuvam...' : 'Sačuvaj prisustvo'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
