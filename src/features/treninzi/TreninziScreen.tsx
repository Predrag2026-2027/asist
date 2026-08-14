import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { T, dugme, polje, labela } from '../../lib/tema'

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

const PALETA = ['#1D9E75', '#D85A30', '#378ADD', '#7F77DD', '#BA7517', '#D4537E', '#639922', '#0F6E56', '#993C1D', '#185FA5']
const DANI = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']
const DANI_PUN = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja']
const MESECI = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
const STATUS: Record<string, { l: string; fg: string; bg: string }> = {
  planiran: { l: 'Zakazano', fg: T.boja.ink600, bg: T.boja.fill },
  odrzan: { l: 'Održan', fg: T.boja.green700, bg: T.boja.greenBg },
  otkazan: { l: 'Otkazan', fg: T.boja.red, bg: T.boja.redBg },
}

function fmt(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
function labelaGrupe(g?: Grupa): string {
  if (!g) return '—'
  return g.uzrast_oznaka ? `${g.naziv} ${g.uzrast_oznaka}` : g.naziv
}

const karta: React.CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 16, padding: 14 }
const pilula = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 99, background: bg, color: fg })

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

  const trenerSelect = (vrednost: string, promeni: (v: string) => void) => (
    <select
      style={polje}
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
    <div style={{ padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>Treninzi</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Kalendar, prisustvo i raspored.</div>
        </div>
        <button onClick={() => setPrikaziRaspored(!prikaziRaspored)} style={dugme('outline-black', 'sm')}>
          {prikaziRaspored ? 'Zatvori raspored' : 'Raspored'}
        </button>
      </div>

      {prikaziRaspored && (
        <div style={{ ...karta, marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Ponavljajući raspored</div>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500, marginTop: 0 }}>
            Definiši termine grupa po danima, pa klikni „Generiši" da se treninzi automatski upišu za prikazani mesec.
          </p>

          {raspored.length === 0 ? (
            <p style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Još nema definisanih termina.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {raspored.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600, borderLeft: `3px solid ${grupaBoja(s.grupa_id)}`, background: T.boja.bg, borderRadius: '0 10px 10px 0', padding: '8px 12px' }}>
                  <div>
                    <b>{labelaGrupe(grupaMap.get(s.grupa_id))}</b> · {DANI_PUN[s.dan_u_nedelji - 1]} {s.vreme ? s.vreme.slice(0, 5) : ''}
                    {s.mesto ? ` · ${s.mesto}` : ''}{s.trener_id ? ` · ${trenerMap.get(s.trener_id)}` : ''}
                  </div>
                  <button onClick={() => obrisiSlot(s.id)} style={{ border: 'none', background: 'none', color: T.boja.red, cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: `1px solid ${T.boja.edge}`, paddingTop: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <label style={labela}>Grupa</label>
              <select style={polje} value={rGrupa} onChange={(e) => setRGrupa(e.target.value)}>
                <option value="">— izaberi —</option>
                {grupe.map((g) => (
                  <option key={g.id} value={g.id}>{labelaGrupe(g)}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labela}>Dan</label>
                <select style={polje} value={rDan} onChange={(e) => setRDan(Number(e.target.value))}>
                  {DANI_PUN.map((d, i) => (
                    <option key={i} value={i + 1}>{d}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labela}>Vreme</label>
                <input type="time" style={polje} value={rVreme} onChange={(e) => setRVreme(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={labela}>Mesto / hala</label>
              <input style={polje} value={rMesto} onChange={(e) => setRMesto(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labela}>Trener</label>
              {trenerSelect(rTrener, setRTrener)}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={dodajSlot} style={dugme('outline-black', 'sm')}>+ Dodaj termin</button>
              <button onClick={generisi} disabled={radi} style={{ ...dugme('brand', 'sm'), marginLeft: 'auto' }}>
                {radi ? 'Generišem...' : `Generiši za ${MESECI[mesecDatum.getMonth()]}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ ...karta, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => pomeriMesec(-1)} style={dugme('ghost-black', 'sm')}>‹</button>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{MESECI[mesecDatum.getMonth()]} {mesecDatum.getFullYear()}</div>
          <button onClick={() => pomeriMesec(1)} style={dugme('ghost-black', 'sm')}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, fontSize: 11, fontWeight: 700, color: T.boja.ink500, textAlign: 'center', marginBottom: 6 }}>
          {DANI.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
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
                  minHeight: 46,
                  border: `1px solid ${izabran || danas ? T.boja.brand : T.boja.edge}`,
                  background: izabran ? T.boja.pill : '#fff',
                  borderRadius: 10,
                  padding: '5px 0 3px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: danas ? 800 : 600, color: danas ? T.boja.brand : T.boja.ink }}>{Number(dan.slice(8, 10))}</div>
                <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap', minHeight: 7, marginTop: 2 }}>
                  {t.slice(0, 4).map((x) => (
                    <span key={x.id} style={{ width: 6, height: 6, borderRadius: '50%', background: grupaBoja(x.grupa_id) }} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {poruka && <p style={{ fontSize: 14, fontWeight: 700, color: poruka.tip === 'greska' ? T.boja.red : T.boja.green700, marginTop: 0 }}>{poruka.tekst}</p>}

      {izabraniDan && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Termini · {izabraniDan.split('-').reverse().join('.')}.</div>
            {!prikaziFormu && <button onClick={() => setPrikaziFormu(true)} style={dugme('brand', 'sm')}>+ Novi trening</button>}
          </div>

          {preklapanja.size > 0 && (
            <p style={{ fontSize: 13, fontWeight: 700, color: T.boja.brand, marginTop: 0 }}>⚠ Preklapanje: dva termina u istoj hali u isto vreme.</p>
          )}

          {prikaziFormu && (
            <div style={{ ...karta, borderColor: T.boja.brand, marginBottom: 10 }}>
              <div style={{ marginBottom: 8 }}>
                <label style={labela}>Grupa *</label>
                <select style={polje} value={novaGrupa} onChange={(e) => setNovaGrupa(e.target.value)}>
                  <option value="">— izaberi grupu —</option>
                  {grupe.map((g) => (
                    <option key={g.id} value={g.id}>{labelaGrupe(g)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labela}>Vreme</label>
                  <input type="time" style={polje} value={novoVreme} onChange={(e) => setNovoVreme(e.target.value)} />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={labela}>Mesto / hala</label>
                  <input style={polje} value={novoMesto} onChange={(e) => setNovoMesto(e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labela}>Trener</label>
                {trenerSelect(noviTrener, setNoviTrener)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={sacuvajNovi} disabled={radi} style={{ ...dugme('brand', 'md'), flex: 1 }}>
                  {radi ? 'Čuvam...' : 'Dodaj trening'}
                </button>
                <button onClick={() => setPrikaziFormu(false)} style={dugme('ghost-black', 'md')}>Otkaži</button>
              </div>
            </div>
          )}

          {terminiDana.length === 0 && !prikaziFormu ? (
            <p style={{ color: T.boja.ink500, fontSize: 14, fontWeight: 600 }}>Nema termina za ovaj dan.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {terminiDana.map((t) => {
                const g = grupaMap.get(t.grupa_id)
                const st = STATUS[t.status] ?? STATUS.planiran
                const otvoren = otvoreniId === t.id
                const sukob = preklapanja.has(t.id)
                return (
                  <div key={t.id} style={{ background: '#fff', border: `1px solid ${sukob ? T.boja.brand : T.boja.edge}`, borderLeft: `3px solid ${grupaBoja(t.grupa_id)}`, borderRadius: 14, padding: 14 }}>
                    <div onClick={() => otvori(t)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                        <div style={{ width: 62, flex: '0 0 62px', padding: '8px 0', borderRadius: 11, background: T.boja.fill, textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{t.vreme ? t.vreme.slice(0, 5) : '--:--'}</div>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800 }}>{labelaGrupe(g)}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>
                            {[t.mesto, t.trener_id ? trenerMap.get(t.trener_id) : null].filter(Boolean).join(' · ') || 'bez detalja'}
                          </div>
                        </div>
                      </div>
                      <span style={pilula(st.bg, st.fg)}>{st.l}</span>
                    </div>

                    {otvoren && (
                      <div style={{ marginTop: 12, borderTop: `1px solid ${T.boja.edge}`, paddingTop: 12 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label style={labela}>Vreme</label>
                            <input type="time" style={polje} value={edit.vreme} onChange={(e) => setEdit({ ...edit, vreme: e.target.value })} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={labela}>Status</label>
                            <select style={polje} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                              <option value="planiran">Zakazano</option>
                              <option value="odrzan">Održan</option>
                              <option value="otkazan">Otkazan</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={labela}>Mesto / hala</label>
                          <input style={polje} value={edit.mesto} onChange={(e) => setEdit({ ...edit, mesto: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={labela}>Trener</label>
                          {trenerSelect(edit.trener_id, (v) => setEdit({ ...edit, trener_id: v }))}
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={labela}>Plan i program</label>
                          <textarea style={{ ...polje, height: 'auto', minHeight: 56, padding: '10px 14px', resize: 'vertical' }} value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                          <label style={labela}>Napomena / komentar</label>
                          <input style={polje} value={edit.napomena} onChange={(e) => setEdit({ ...edit, napomena: e.target.value })} />
                        </div>

                        <div style={{ background: T.boja.ink, borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.boja.brandOnDark }}>Prisustvo</div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{prisutni.size} <span style={{ color: T.boja.ink400, fontSize: 15 }}>/ {deca.length}</span></div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setPrisutni(new Set(deca.map((d) => d.id)))} style={{ ...dugme('outline-black', 'sm'), background: 'transparent', color: '#fff', borderColor: T.boja.ink700 }}>Svi</button>
                              <button onClick={() => setPrisutni(new Set())} style={{ ...dugme('ghost-black', 'sm'), color: T.boja.ink400 }}>Očisti</button>
                            </div>
                          </div>
                          {deca.length === 0 ? (
                            <p style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink400, margin: 0 }}>Grupa nema aktivnih članova.</p>
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
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 700,
                                      padding: '7px 12px',
                                      borderRadius: 10,
                                      cursor: 'pointer',
                                      border: `1px solid ${p ? T.boja.green : T.boja.ink700}`,
                                      background: p ? T.boja.green : 'transparent',
                                      color: p ? '#fff' : T.boja.ink400,
                                    }}
                                  >
                                    {p ? '✓ ' : ''}{d.ime}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => sacuvajDetalj(t)} disabled={radi} style={{ ...dugme('default-purple', 'md'), flex: 1 }}>
                            {radi ? 'Čuvam...' : 'Sačuvaj prisustvo'}
                          </button>
                          <button onClick={() => obrisi(t)} style={dugme('outline-danger', 'md')}>Obriši</button>
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

      {!izabraniDan && <p style={{ color: T.boja.ink500, fontSize: 14, fontWeight: 600 }}>Izaberi dan u kalendaru da vidiš ili dodaš treninge.</p>}
    </div>
  )
}
