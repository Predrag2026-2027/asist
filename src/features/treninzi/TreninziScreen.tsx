import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Grupa = { id: string; naziv: string; tip: string; uzrast_oznaka: string | null }
type Trener = { id: string; ime: string }
type Dete = { id: string; ime: string }
type Trening = {
  id: string
  grupa_id: string
  datum: string
  vreme: string | null
  mesto: string | null
  trener_id: string | null
  plan: string | null
  napomena: string | null
  status: string
}
type Slot = {
  id: string
  grupa_id: string
  dan_u_nedelji: number
  vreme: string | null
  mesto: string | null
  trener_id: string | null
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

const PALETA = ['#1D9E75', '#D85A30', '#378ADD', '#7F77DD', '#BA7517', '#D4537E', '#639922', '#0F6E56', '#993C1D', '#185FA5']
const DANI = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']
const DANI_PUN = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja']
const MESECI = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
const STATUS: Record<string, { l: string; c: string; bg: string }> = {
  planiran: { l: 'Planiran', c: boja.meki, bg: '#f1efe8' },
  odrzan: { l: 'Održan', c: boja.uspeh, bg: '#eaf3ea' },
  otkazan: { l: 'Otkazan', c: boja.greska, bg: '#fbeaea' },
}

function fmt(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
function labelaGrupe(g?: Grupa): string {
  if (!g) return '—'
  return g.uzrast_oznaka ? `${g.naziv} ${g.uzrast_oznaka}` : g.naziv
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

export default function TreninziScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [grupe, setGrupe] = useState<Grupa[]>([])
  const [treneri, setTreneri] = useState<Trener[]>([])
  const [raspored, setRaspored] = useState<Slot[]>([])
  const [mesecDatum, setMesecDatum] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [treninzi, setTreninzi] = useState<Trening[]>([])
  const [izabraniDan, setIzabraniDan] = useState<string | null>(null)
  const [prikaziFormu, setPrikaziFormu] = useState(false)
  const [otvoreniId, setOtvoreniId] = useState<string | null>(null)
  const [prikaziRaspored, setPrikaziRaspored] = useState(false)
  const [poruka, setPoruka] = useState<{ tip: 'greska' | 'uspeh'; tekst: string } | null>(null)
  const [radi, setRadi] = useState(false)

  const [novaGrupa, setNovaGrupa] = useState('')
  const [novoVreme, setNovoVreme] = useState('18:00')
  const [novoMesto, setNovoMesto] = useState('')
  const [noviTrener, setNoviTrener] = useState('')

  const [rGrupa, setRGrupa] = useState('')
  const [rDan, setRDan] = useState(1)
  const [rVreme, setRVreme] = useState('18:00')
  const [rMesto, setRMesto] = useState('')
  const [rTrener, setRTrener] = useState('')

  const [edit, setEdit] = useState({ vreme: '', mesto: '', trener_id: '', plan: '', napomena: '', status: 'planiran' })
  const [deca, setDeca] = useState<Dete[]>([])
  const [prisutni, setPrisutni] = useState<Set<string>>(new Set())

  const grupaMap = new Map(grupe.map((g) => [g.id, g]))
  const grupaIndeks = new Map(grupe.map((g, i) => [g.id, i]))
  const trenerMap = new Map(treneri.map((t) => [t.id, t.ime]))
  function grupaBoja(id: string): string {
    return PALETA[(grupaIndeks.get(id) ?? 0) % PALETA.length]
  }

  async function ucitajOsnovu() {
    const { data: sez } = await supabase.from('sezone').select('id').eq('aktivna', true).maybeSingle()
    const sid = (sez as any)?.id ?? null
    setSezonaId(sid)
    if (!sid) return
    const { data: g } = await supabase.from('grupe').select('id, naziv, tip, uzrast_oznaka').eq('sezona_id', sid).order('tip').order('naziv')
    setGrupe((g as any) ?? [])
    const { data: t } = await supabase.from('treneri').select('id, ime').order('ime')
    setTreneri((t as any) ?? [])
    await ucitajRaspored(sid)
  }

  async function ucitajRaspored(sid: string) {
    const { data } = await supabase
      .from('raspored')
      .select('id, grupa_id, dan_u_nedelji, vreme, mesto, trener_id')
      .eq('sezona_id', sid)
      .order('dan_u_nedelji')
      .order('vreme')
    setRaspored((data as any) ?? [])
  }

  async function ucitajMesec(sid: string, m: Date) {
    const prvi = fmt(new Date(m.getFullYear(), m.getMonth(), 1))
    const posl = fmt(new Date(m.getFullYear(), m.getMonth() + 1, 0))
    const { data } = await supabase
      .from('treninzi')
      .select('id, grupa_id, datum, vreme, mesto, trener_id, plan, napomena, status')
      .eq('sezona_id', sid)
      .gte('datum', prvi)
      .lte('datum', posl)
      .order('vreme')
    setTreninzi((data as any) ?? [])
  }

  useEffect(() => {
    ucitajOsnovu()
  }, [])
  useEffect(() => {
    if (sezonaId) ucitajMesec(sezonaId, mesecDatum)
    setOtvoreniId(null)
  }, [sezonaId, mesecDatum])

  function pomeriMesec(delta: number) {
    setMesecDatum(new Date(mesecDatum.getFullYear(), mesecDatum.getMonth() + delta, 1))
    setIzabraniDan(null)
    setPrikaziFormu(false)
  }

  const danasnji = fmt(new Date())
  const dana = new Date(mesecDatum.getFullYear(), mesecDatum.getMonth() + 1, 0).getDate()
  const offset = (new Date(mesecDatum.getFullYear(), mesecDatum.getMonth(), 1).getDay() + 6) % 7
  const celije: (string | null)[] = []
  for (let i = 0; i < offset; i++) celije.push(null)
  for (let d = 1; d <= dana; d++) celije.push(fmt(new Date(mesecDatum.getFullYear(), mesecDatum.getMonth(), d)))

  const poDanu = new Map<string, Trening[]>()
  for (const t of treninzi) {
    const arr = poDanu.get(t.datum) ?? []
    arr.push(t)
    poDanu.set(t.datum, arr)
  }
  const terminiDana = izabraniDan ? poDanu.get(izabraniDan) ?? [] : []

  const preklapanja = new Set<string>()
  const kombinacije = new Map<string, string[]>()
  for (const t of terminiDana) {
    if (!t.vreme || !t.mesto) continue
    const kljuc = `${t.vreme}|${t.mesto.trim().toLowerCase()}`
    const arr = kombinacije.get(kljuc) ?? []
    arr.push(t.id)
    kombinacije.set(kljuc, arr)
  }
  for (const arr of kombinacije.values()) if (arr.length > 1) arr.forEach((id) => preklapanja.add(id))

  async function dodajTrenera() {
    const ime = window.prompt('Ime trenera:')
    if (!ime || !ime.trim()) return
    const { data, error } = await supabase.from('treneri').insert({ ime: ime.trim() }).select('id, ime').single()
    if (error) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + error.message })
      return
    }
    setTreneri([...treneri, data as any].sort((a, b) => a.ime.localeCompare(b.ime)))
    return (data as any).id as string
  }

  async function dodajSlot() {
    if (!rGrupa || !sezonaId) {
      setPoruka({ tip: 'greska', tekst: 'Izaberi grupu za raspored.' })
      return
    }
    const { error } = await supabase.from('raspored').insert({
      grupa_id: rGrupa,
      sezona_id: sezonaId,
      dan_u_nedelji: rDan,
      vreme: rVreme || null,
      mesto: rMesto.trim() || null,
      trener_id: rTrener || null,
    })
    if (error) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + error.message })
      return
    }
    setRMesto('')
    await ucitajRaspored(sezonaId)
  }

  async function obrisiSlot(id: string) {
    const { error } = await supabase.from('raspored').delete().eq('id', id)
    if (!error && sezonaId) await ucitajRaspored(sezonaId)
  }

  async function generisi() {
    if (!sezonaId || raspored.length === 0) {
      setPoruka({ tip: 'greska', tekst: 'Prvo definiši raspored (bar jedan termin).' })
      return
    }
    setRadi(true)
    setPoruka(null)
    try {
      const inserts: any[] = []
      for (let d = 1; d <= dana; d++) {
        const date = new Date(mesecDatum.getFullYear(), mesecDatum.getMonth(), d)
        const dow = ((date.getDay() + 6) % 7) + 1
        for (const s of raspored) {
          if (s.dan_u_nedelji === dow) {
            inserts.push({
              grupa_id: s.grupa_id,
              sezona_id: sezonaId,
              datum: fmt(date),
              vreme: s.vreme,
              mesto: s.mesto,
              trener_id: s.trener_id,
              status: 'planiran',
            })
          }
        }
      }
      const { data, error } = await supabase
        .from('treninzi')
        .upsert(inserts, { onConflict: 'grupa_id,datum', ignoreDuplicates: true })
        .select('id')
      if (error) throw error
      const noviBroj = (data as any[])?.length ?? 0
      setPoruka({ tip: 'uspeh', tekst: `Generisano ${noviBroj} novih termina za ${MESECI[mesecDatum.getMonth()]} (postojeći preskočeni).` })
      await ucitajMesec(sezonaId, mesecDatum)
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) })
    } finally {
      setRadi(false)
    }
  }

  async function sacuvajNovi() {
    if (!izabraniDan || !sezonaId) return
    if (!novaGrupa) {
      setPoruka({ tip: 'greska', tekst: 'Izaberi grupu.' })
      return
    }
    setRadi(true)
    setPoruka(null)
    try {
      const { error } = await supabase.from('treninzi').insert({
        grupa_id: novaGrupa,
        sezona_id: sezonaId,
        datum: izabraniDan,
        vreme: novoVreme || null,
        mesto: novoMesto.trim() || null,
        trener_id: noviTrener || null,
        status: 'planiran',
      })
      if (error) {
        if (error.code === '23505') throw new Error('Za tu grupu već postoji trening tog dana.')
        throw error
      }
      setPrikaziFormu(false)
      setNovaGrupa('')
      setNovoMesto('')
      setNoviTrener('')
      await ucitajMesec(sezonaId, mesecDatum)
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) })
    } finally {
      setRadi(false)
    }
  }

  async function otvori(t: Trening) {
    if (otvoreniId === t.id) {
      setOtvoreniId(null)
      return
    }
    setOtvoreniId(t.id)
    setPoruka(null)
    setEdit({ vreme: t.vreme ?? '', mesto: t.mesto ?? '', trener_id: t.trener_id ?? '', plan: t.plan ?? '', napomena: t.napomena ?? '', status: t.status })
    const { data: cl } = await supabase.from('clanstvo').select('clan_id').eq('grupa_id', t.grupa_id).eq('sezona_id', sezonaId).is('datum_do', null)
    const ids = [...new Set(((cl as any[]) ?? []).map((x) => x.clan_id))]
    let decaList: Dete[] = []
    if (ids.length) {
      const { data: c } = await supabase.from('clanovi').select('id, ime').in('id', ids).eq('status', 'aktivan').order('ime')
      decaList = (c as any) ?? []
    }
    setDeca(decaList)
    const { data: pr } = await supabase.from('prisustvo').select('clan_id, prisutan').eq('trening_id', t.id)
    const present = new Set<string>()
    const marked = new Set<string>()
    for (const r of (pr as any[]) ?? []) {
      marked.add(r.clan_id)
      if (r.prisutan) present.add(r.clan_id)
    }
    for (const d of decaList) if (!marked.has(d.id)) present.add(d.id)
    setPrisutni(present)
  }

  async function sacuvajDetalj(t: Trening) {
    if (!sezonaId) return
    setRadi(true)
    setPoruka(null)
    try {
      const { error: e1 } = await supabase
        .from('treninzi')
        .update({
          vreme: edit.vreme || null,
          mesto: edit.mesto.trim() || null,
          trener_id: edit.trener_id || null,
          plan: edit.plan.trim() || null,
          napomena: edit.napomena.trim() || null,
          status: edit.status,
        })
        .eq('id', t.id)
      if (e1) throw e1
      if (deca.length) {
        const arr = deca.map((d) => ({ trening_id: t.id, clan_id: d.id, prisutan: prisutni.has(d.id) }))
        const { error: e2 } = await supabase.from('prisustvo').upsert(arr, { onConflict: 'trening_id,clan_id' })
        if (e2) throw e2
      }
      setPoruka({ tip: 'uspeh', tekst: 'Sačuvano.' })
      await ucitajMesec(sezonaId, mesecDatum)
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) })
    } finally {
      setRadi(false)
    }
  }

  async function obrisi(t: Trening) {
    if (!window.confirm('Obrisati ovaj trening?')) return
    const { error } = await supabase.from('treninzi').delete().eq('id', t.id)
    if (error) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + error.message })
      return
    }
    setOtvoreniId(null)
    if (sezonaId) await ucitajMesec(sezonaId, mesecDatum)
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
  const trenerSelect = (vrednost: string, promeni: (v: string) => void) => (
    <select
      style={stilInput}
      value={vrednost}
      onChange={async (e) => {
        if (e.target.value === '__novi__') {
          const id = await dodajTrenera()
          if (id) promeni(id)
        } else promeni(e.target.value)
      }}
    >
      <option value="">— bez trenera —</option>
      {treneri.map((t) => (
        <option key={t.id} value={t.id}>{t.ime}</option>
      ))}
      <option value="__novi__">+ dodaj novog trenera…</option>
    </select>
  )

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: boja.pozadina, color: boja.tekst, minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Kalendar treninga</h1>
          <button onClick={() => setPrikaziRaspored(!prikaziRaspored)} style={dugmeMalo}>
            {prikaziRaspored ? 'Zatvori raspored' : 'Raspored'}
          </button>
        </div>

        {prikaziRaspored && (
          <div style={{ background: boja.karta, border: `1px solid ${boja.ivica}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Ponavljajući raspored</div>
            <p style={{ fontSize: 13, color: boja.meki, marginTop: 0 }}>
              Definiši termine grupa po danima, pa klikni „Generiši" da se treninzi automatski upišu za prikazani mesec.
            </p>

            {raspored.length === 0 ? (
              <p style={{ fontSize: 13, color: boja.meki }}>Još nema definisanih termina.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {raspored.map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderLeft: `3px solid ${grupaBoja(s.grupa_id)}`, background: boja.pozadina, borderRadius: '0 8px 8px 0', padding: '6px 10px' }}>
                    <div>
                      <b>{labelaGrupe(grupaMap.get(s.grupa_id))}</b> · {DANI_PUN[s.dan_u_nedelji - 1]} {s.vreme ? s.vreme.slice(0, 5) : ''}
                      {s.mesto ? ` · ${s.mesto}` : ''}{s.trener_id ? ` · ${trenerMap.get(s.trener_id)}` : ''}
                    </div>
                    <button onClick={() => obrisiSlot(s.id)} style={{ border: 'none', background: 'none', color: boja.greska, cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: `1px solid ${boja.ivica}`, paddingTop: 10 }}>
              <div style={{ marginBottom: 8 }}>
                <label style={stilLabela}>Grupa</label>
                <select style={stilInput} value={rGrupa} onChange={(e) => setRGrupa(e.target.value)}>
                  <option value="">— izaberi —</option>
                  {grupe.map((g) => (
                    <option key={g.id} value={g.id}>{labelaGrupe(g)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={stilLabela}>Dan</label>
                  <select style={stilInput} value={rDan} onChange={(e) => setRDan(Number(e.target.value))}>
                    {DANI_PUN.map((d, i) => (
                      <option key={i} value={i + 1}>{d}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={stilLabela}>Vreme</label>
                  <input type="time" style={stilInput} value={rVreme} onChange={(e) => setRVreme(e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={stilLabela}>Mesto / hala</label>
                <input style={stilInput} value={rMesto} onChange={(e) => setRMesto(e.target.value)} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={stilLabela}>Trener</label>
                {trenerSelect(rTrener, setRTrener)}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={dodajSlot} style={dugmeMalo}>+ Dodaj termin u raspored</button>
                <button onClick={generisi} disabled={radi} style={{ ...dugmeMalo, background: boja.akcenat, color: '#fff', border: 'none', fontWeight: 600, marginLeft: 'auto' }}>
                  {radi ? 'Generišem...' : `Generiši za ${MESECI[mesecDatum.getMonth()]}`}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={() => pomeriMesec(-1)} style={dugmeMalo}>‹</button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{MESECI[mesecDatum.getMonth()]} {mesecDatum.getFullYear()}</div>
          <button onClick={() => pomeriMesec(1)} style={dugmeMalo}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, fontSize: 11, color: boja.meki, textAlign: 'center', marginBottom: 4 }}>
          {DANI.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {celije.map((dan, i) => {
            if (!dan) return <div key={i} />
            const t = poDanu.get(dan) ?? []
            const izabran = dan === izabraniDan
            const danas = dan === danasnji
            return (
              <button
                key={i}
                onClick={() => {
                  setIzabraniDan(dan)
                  setPrikaziFormu(false)
                  setOtvoreniId(null)
                }}
                style={{
                  minHeight: 42,
                  border: `1px solid ${izabran ? boja.akcenat : boja.ivica}`,
                  background: izabran ? '#fbeee8' : boja.karta,
                  borderRadius: 8,
                  padding: '3px 0 2px',
                  cursor: 'pointer',
                  color: boja.tekst,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: danas ? 700 : 400, color: danas ? boja.akcenat : boja.tekst }}>{Number(dan.slice(8, 10))}</div>
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', minHeight: 6 }}>
                  {t.slice(0, 4).map((x) => (
                    <span key={x.id} style={{ width: 5, height: 5, borderRadius: '50%', background: grupaBoja(x.grupa_id) }} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        {poruka && <p style={{ fontSize: 14, color: poruka.tip === 'greska' ? boja.greska : boja.uspeh, marginTop: 12 }}>{poruka.tekst}</p>}

        {izabraniDan && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Termini · {izabraniDan.split('-').reverse().join('.')}.</div>
              {!prikaziFormu && <button onClick={() => setPrikaziFormu(true)} style={dugmeMalo}>+ Novi trening</button>}
            </div>

            {preklapanja.size > 0 && (
              <p style={{ fontSize: 13, color: boja.akcenat, marginTop: 0 }}>⚠ Preklapanje: dva termina u istoj hali u isto vreme.</p>
            )}

            {prikaziFormu && (
              <div style={{ background: boja.karta, border: `1px solid ${boja.akcenat}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ marginBottom: 8 }}>
                  <label style={stilLabela}>Grupa *</label>
                  <select style={stilInput} value={novaGrupa} onChange={(e) => setNovaGrupa(e.target.value)}>
                    <option value="">— izaberi grupu —</option>
                    {grupe.map((g) => (
                      <option key={g.id} value={g.id}>{labelaGrupe(g)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={stilLabela}>Vreme</label>
                    <input type="time" style={stilInput} value={novoVreme} onChange={(e) => setNovoVreme(e.target.value)} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={stilLabela}>Mesto / hala</label>
                    <input style={stilInput} value={novoMesto} onChange={(e) => setNovoMesto(e.target.value)} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={stilLabela}>Trener</label>
                  {trenerSelect(noviTrener, setNoviTrener)}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={sacuvajNovi} disabled={radi} style={{ ...dugmeMalo, background: boja.akcenat, color: '#fff', border: 'none', fontWeight: 600, flex: 1 }}>
                    {radi ? 'Čuvam...' : 'Dodaj trening'}
                  </button>
                  <button onClick={() => setPrikaziFormu(false)} style={dugmeMalo}>Otkaži</button>
                </div>
              </div>
            )}

            {terminiDana.length === 0 && !prikaziFormu ? (
              <p style={{ color: boja.meki, fontSize: 14 }}>Nema termina za ovaj dan.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {terminiDana.map((t) => {
                  const g = grupaMap.get(t.grupa_id)
                  const st = STATUS[t.status] ?? STATUS.planiran
                  const otvoren = otvoreniId === t.id
                  const sukob = preklapanja.has(t.id)
                  return (
                    <div key={t.id} style={{ background: boja.karta, border: `1px solid ${sukob ? boja.akcenat : boja.ivica}`, borderLeft: `3px solid ${grupaBoja(t.grupa_id)}`, borderRadius: 10, padding: '10px 12px' }}>
                      <div onClick={() => otvori(t)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{t.vreme ? t.vreme.slice(0, 5) + ' · ' : ''}{labelaGrupe(g)}</div>
                          <div style={{ fontSize: 12, color: boja.meki }}>
                            {[t.mesto, t.trener_id ? trenerMap.get(t.trener_id) : null].filter(Boolean).join(' · ') || 'bez detalja'}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: st.c, background: st.bg, padding: '2px 8px', borderRadius: 20 }}>{st.l}</span>
                      </div>

                      {otvoren && (
                        <div style={{ marginTop: 10, borderTop: `1px solid ${boja.ivica}`, paddingTop: 10 }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <div style={{ flex: 1 }}>
                              <label style={stilLabela}>Vreme</label>
                              <input type="time" style={stilInput} value={edit.vreme} onChange={(e) => setEdit({ ...edit, vreme: e.target.value })} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={stilLabela}>Status</label>
                              <select style={stilInput} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                                <option value="planiran">Planiran</option>
                                <option value="odrzan">Održan</option>
                                <option value="otkazan">Otkazan</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <label style={stilLabela}>Mesto / hala</label>
                            <input style={stilInput} value={edit.mesto} onChange={(e) => setEdit({ ...edit, mesto: e.target.value })} />
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <label style={stilLabela}>Trener</label>
                            {trenerSelect(edit.trener_id, (v) => setEdit({ ...edit, trener_id: v }))}
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <label style={stilLabela}>Plan i program</label>
                            <textarea style={{ ...stilInput, minHeight: 54, resize: 'vertical' }} value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })} />
                          </div>
                          <div style={{ marginBottom: 12 }}>
                            <label style={stilLabela}>Napomena / komentar</label>
                            <input style={stilInput} value={edit.napomena} onChange={(e) => setEdit({ ...edit, napomena: e.target.value })} />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Prisustvo: {prisutni.size} / {deca.length}</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setPrisutni(new Set(deca.map((d) => d.id)))} style={dugmeMalo}>Svi</button>
                              <button onClick={() => setPrisutni(new Set())} style={dugmeMalo}>Niko</button>
                            </div>
                          </div>
                          {deca.length === 0 ? (
                            <p style={{ fontSize: 13, color: boja.meki }}>Grupa nema aktivnih članova.</p>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {deca.map((d) => {
                                const p = prisutni.has(d.id)
                                return (
                                  <button
                                    key={d.id}
                                    onClick={() => {
                                      const s = new Set(prisutni)
                                      if (s.has(d.id)) s.delete(d.id)
                                      else s.add(d.id)
                                      setPrisutni(s)
                                    }}
                                    style={{ fontSize: 13, padding: '6px 10px', borderRadius: 16, cursor: 'pointer', border: `1px solid ${p ? boja.uspeh : boja.ivica}`, background: p ? '#eaf3ea' : boja.karta, color: p ? boja.uspeh : boja.meki }}
                                  >
                                    {p ? '✓ ' : ''}{d.ime}
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                            <button onClick={() => sacuvajDetalj(t)} disabled={radi} style={{ ...dugmeMalo, background: boja.akcenat, color: '#fff', border: 'none', fontWeight: 600, flex: 1 }}>
                              {radi ? 'Čuvam...' : 'Sačuvaj'}
                            </button>
                            <button onClick={() => obrisi(t)} style={{ ...dugmeMalo, color: boja.greska }}>Obriši</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!izabraniDan && <p style={{ color: boja.meki, fontSize: 14, marginTop: 16 }}>Izaberi dan u kalendaru da vidiš ili dodaš treninge.</p>}
      </div>
    </div>
  )
}
