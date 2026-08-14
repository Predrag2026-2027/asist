import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { T, dugme, polje, labela } from '../../lib/tema'

type Grupa = { id: string; naziv: string; uzrast_oznaka: string | null }
type Duznik = { naziv: string; telefon: string | null; preostalo: number }
type Sopstveno = { id: string; naziv: string; tekst: string }

const MESECI: Record<number, string> = {
  1: 'Januar', 2: 'Februar', 3: 'Mart', 4: 'April', 5: 'Maj', 6: 'Jun',
  7: 'Jul', 8: 'Avgust', 9: 'Septembar', 10: 'Oktobar', 11: 'Novembar', 12: 'Decembar',
}
const DANI = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja']

function fmt(d: Date): string { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
function ddmm(d: string): string { const [, m, dan] = d.split('-'); return `${dan}.${m}.` }
function formatRSD(n: number): string { return new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 0 }).format(n) + ' RSD' }
function labelaGrupe(g?: Grupa): string { if (!g) return ''; return g.uzrast_oznaka ? `${g.naziv} ${g.uzrast_oznaka}` : g.naziv }

const karta: React.CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 16, padding: 16, marginTop: 14 }
const oblastText: React.CSSProperties = { ...polje, height: 'auto', minHeight: 120, padding: '10px 14px', resize: 'vertical', fontFamily: 'inherit' }

export default function ObavestenjaScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [pocetnaGodina, setPocetnaGodina] = useState(new Date().getFullYear())
  const [grupe, setGrupe] = useState<Map<string, Grupa>>(new Map())
  const [cenovnik, setCenovnik] = useState<{ i1: number; i2: number; i3: number } | null>(null)
  const [kopiran, setKopiran] = useState<string | null>(null)

  const [datumNedelje, setDatumNedelje] = useState(() => new Date().toISOString().slice(0, 10))
  const [tekstRaspored, setTekstRaspored] = useState('')

  const meseci = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]
  const [mesec, setMesec] = useState(9)
  const [tekstPodsetnik, setTekstPodsetnik] = useState('')
  const [duznici, setDuznici] = useState<Duznik[]>([])

  const [mojaLista, setMojaLista] = useState<Sopstveno[]>([])
  const [mNaziv, setMNaziv] = useState('')
  const [mTekst, setMTekst] = useState('')
  const [mEditId, setMEditId] = useState<string | null>(null)
  const [mPoruka, setMPoruka] = useState<string | null>(null)

  async function ucitajOsnovu() {
    const { data: sez } = await supabase.from('sezone').select('id, datum_od').eq('aktivna', true).maybeSingle()
    const s = sez as any
    if (!s) return
    setSezonaId(s.id)
    setPocetnaGodina(s.datum_od ? new Date(s.datum_od).getFullYear() : new Date().getFullYear())
    const { data: g } = await supabase.from('grupe').select('id, naziv, uzrast_oznaka').eq('sezona_id', s.id)
    setGrupe(new Map(((g as any[]) ?? []).map((x) => [x.id, x])))
    const { data: cen } = await supabase.from('cenovnik').select('iznos_1_dete, iznos_2_dete, iznos_3plus').eq('sezona_id', s.id).order('vazi_od', { ascending: false }).limit(1).maybeSingle()
    if (cen) setCenovnik({ i1: Number((cen as any).iznos_1_dete), i2: Number((cen as any).iznos_2_dete), i3: Number((cen as any).iznos_3plus) })
    await ucitajMoja()
  }

  async function ucitajMoja() {
    const { data } = await supabase.from('obavestenja').select('id, naziv, tekst').order('created_at', { ascending: false })
    setMojaLista((data as any) ?? [])
  }

  useEffect(() => { ucitajOsnovu() }, [])

  async function generisiRaspored() {
    if (!sezonaId) return
    const dt = new Date(datumNedelje + 'T00:00:00')
    const dow = (dt.getDay() + 6) % 7
    const mon = new Date(dt)
    mon.setDate(dt.getDate() - dow)
    const dani: string[] = []
    for (let i = 0; i < 7; i++) { const x = new Date(mon); x.setDate(mon.getDate() + i); dani.push(fmt(x)) }
    const { data } = await supabase.from('treninzi').select('datum, vreme, mesto, grupa_id, status').eq('sezona_id', sezonaId).gte('datum', dani[0]).lte('datum', dani[6]).neq('status', 'otkazan').order('vreme')
    const treninzi = (data as any[]) ?? []

    const linije: string[] = [`Raspored treninga (${ddmm(dani[0])} - ${ddmm(dani[6])})`, '']
    for (let i = 0; i < 7; i++) {
      const dnevni = treninzi.filter((t) => t.datum === dani[i])
      if (dnevni.length === 0) continue
      linije.push(`${DANI[i]} ${ddmm(dani[i])}`)
      for (const t of dnevni) {
        const v = t.vreme ? t.vreme.slice(0, 5) + ' ' : ''
        const m = t.mesto ? ' — ' + t.mesto : ''
        linije.push(`- ${v}${labelaGrupe(grupe.get(t.grupa_id))}${m}`)
      }
      linije.push('')
    }
    linije.push('KK BB Basket')
    setTekstRaspored(linije.join('\n').trim())
  }

  function iznosZa(n: number): number {
    if (!cenovnik || n <= 0) return 0
    let s = 0
    if (n >= 1) s += cenovnik.i1
    if (n >= 2) s += cenovnik.i2
    if (n >= 3) s += cenovnik.i3 * (n - 2)
    return s
  }

  async function generisiPodsetnik() {
    if (!sezonaId) return
    const godina = mesec >= 9 ? pocetnaGodina : pocetnaGodina + 1
    const period = `${godina}-${String(mesec).padStart(2, '0')}-01`

    setTekstPodsetnik([
      'Poštovani roditelji,', '',
      `Podsećamo vas da je članarina za ${MESECI[mesec]} ${godina}. dospela za naplatu.`,
      'Molimo vas da je izmirite na treningu ili dogovorom sa administracijom.', '',
      'Hvala na saradnji!', 'KK BB Basket',
    ].join('\n'))

    const { data: cl } = await supabase.from('clanstvo').select('clan_id').eq('sezona_id', sezonaId).eq('maticno', true).is('datum_do', null)
    const upisani = new Set(((cl as any[]) ?? []).map((x) => x.clan_id))
    const { data: clanovi } = await supabase.from('clanovi').select('id, porodica_id, status')
    const broj: Record<string, number> = {}
    for (const c of (clanovi as any[]) ?? []) { if (c.status === 'aktivan' && upisani.has(c.id)) broj[c.porodica_id] = (broj[c.porodica_id] ?? 0) + 1 }
    const { data: por } = await supabase.from('porodice').select('id, prezime, telefon, clanovi(ime, datum_rodjenja)').order('prezime')
    const { data: zad } = await supabase.from('zaduzenja').select('porodica_id, iznos_ukupno, uplate(iznos)').eq('sezona_id', sezonaId).eq('period', period)
    const zaduzenjaMap: Record<string, { ukupno: number; uplaceno: number }> = {}
    for (const z of (zad as any[]) ?? []) { const uplaceno = (z.uplate ?? []).reduce((s: number, u: any) => s + Number(u.iznos), 0); zaduzenjaMap[z.porodica_id] = { ukupno: Number(z.iznos_ukupno), uplaceno } }

    const lista: Duznik[] = []
    for (const p of (por as any[]) ?? []) {
      const n = broj[p.id] ?? 0
      if (n === 0) continue
      const z = zaduzenjaMap[p.id]
      const ukupno = z?.ukupno ?? iznosZa(n)
      const uplaceno = z?.uplaceno ?? 0
      const preostalo = ukupno - uplaceno
      if (preostalo > 0) {
        const imena = [...p.clanovi].sort((a: any, b: any) => (a.datum_rodjenja ?? '').localeCompare(b.datum_rodjenja ?? '')).map((d: any) => d.ime)
        lista.push({ naziv: `${p.prezime} (${imena.join(', ')})`, telefon: p.telefon, preostalo })
      }
    }
    setDuznici(lista)
  }

  async function kopiraj(tekst: string, kljuc: string) {
    try { await navigator.clipboard.writeText(tekst); setKopiran(kljuc); setTimeout(() => setKopiran(null), 1500) }
    catch { setKopiran('greska'); setTimeout(() => setKopiran(null), 1500) }
  }

  function porukaDuzniku(d: Duznik): string {
    const godina = mesec >= 9 ? pocetnaGodina : pocetnaGodina + 1
    return [
      'Poštovani,', '',
      `Prema našoj evidenciji, članarina za ${MESECI[mesec]} ${godina}. za porodicu ${d.naziv} nije u potpunosti izmirena.`,
      `Preostali iznos: ${formatRSD(d.preostalo)}.`,
      'Molimo vas da je izmirite u najkraćem roku.', '',
      'Hvala!', 'KK BB Basket',
    ].join('\n')
  }

  async function sacuvajMoje() {
    setMPoruka(null)
    if (!mNaziv.trim() || !mTekst.trim()) { setMPoruka('Unesi naziv i tekst.'); return }
    if (mEditId) {
      const { error } = await supabase.from('obavestenja').update({ naziv: mNaziv.trim(), tekst: mTekst }).eq('id', mEditId)
      if (error) { setMPoruka('Greška: ' + error.message); return }
    } else {
      const { error } = await supabase.from('obavestenja').insert({ sezona_id: sezonaId, naziv: mNaziv.trim(), tekst: mTekst })
      if (error) { setMPoruka('Greška: ' + error.message); return }
    }
    setMNaziv(''); setMTekst(''); setMEditId(null)
    setMPoruka('Sačuvano.')
    await ucitajMoja()
  }

  function izmeniMoje(o: Sopstveno) {
    setMEditId(o.id); setMNaziv(o.naziv); setMTekst(o.tekst); setMPoruka(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function obrisiMoje(id: string) {
    if (!window.confirm('Obrisati ovo obaveštenje?')) return
    const { error } = await supabase.from('obavestenja').delete().eq('id', id)
    if (!error) { if (mEditId === id) { setMEditId(null); setMNaziv(''); setMTekst('') } await ucitajMoja() }
  }

  const oznaka = (k: string) => (kopiran === k ? '✓ Kopirano' : 'Kopiraj')

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>Obaveštenja</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Generiši ili napiši tekst i nalepi ga u Viber grupu.</div>
      </div>

      <div style={karta}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{mEditId ? 'Izmena obaveštenja' : 'Novo obaveštenje'}</div>
        <div style={{ marginBottom: 8 }}>
          <label style={labela}>Naziv</label>
          <input style={polje} value={mNaziv} onChange={(e) => setMNaziv(e.target.value)} placeholder="npr. Turnir u subotu" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labela}>Tekst</label>
          <textarea style={oblastText} value={mTekst} onChange={(e) => setMTekst(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={sacuvajMoje} style={dugme('brand', 'md')}>{mEditId ? 'Sačuvaj izmene' : 'Sačuvaj'}</button>
          {mEditId && (<button onClick={() => { setMEditId(null); setMNaziv(''); setMTekst(''); setMPoruka(null) }} style={dugme('ghost-black', 'md')}>Otkaži</button>)}
          {mPoruka && <span style={{ fontSize: 13, fontWeight: 700, color: mPoruka.startsWith('Greška') ? T.boja.red : T.boja.green700 }}>{mPoruka}</span>}
        </div>

        {mojaLista.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Sačuvana obaveštenja</div>
            {mojaLista.map((o) => (
              <div key={o.id} style={{ border: `1px solid ${T.boja.edge}`, borderRadius: 14, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{o.naziv}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => kopiraj(o.tekst, 'm' + o.id)} style={dugme('outline-black', 'sm')}>{oznaka('m' + o.id)}</button>
                    <button onClick={() => izmeniMoje(o)} style={dugme('ghost-black', 'sm')}>Izmeni</button>
                    <button onClick={() => obrisiMoje(o.id)} style={dugme('outline-danger', 'sm')}>×</button>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500, marginTop: 4, whiteSpace: 'pre-wrap' }}>{o.tekst}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={karta}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Raspored treninga za nedelju</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labela}>Bilo koji dan u željenoj nedelji</label>
            <input type="date" style={polje} value={datumNedelje} onChange={(e) => setDatumNedelje(e.target.value)} />
          </div>
          <button onClick={generisiRaspored} style={dugme('outline-black', 'md')}>Generiši</button>
        </div>
        {tekstRaspored && (
          <>
            <textarea value={tekstRaspored} onChange={(e) => setTekstRaspored(e.target.value)} style={{ ...oblastText, minHeight: 140 }} />
            <button onClick={() => kopiraj(tekstRaspored, 'raspored')} style={{ ...dugme('brand', 'md'), marginTop: 8 }}>{oznaka('raspored')}</button>
          </>
        )}
      </div>

      <div style={karta}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Podsetnik za članarinu</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labela}>Mesec</label>
            <select style={polje} value={mesec} onChange={(e) => setMesec(Number(e.target.value))}>
              {meseci.map((m) => (<option key={m} value={m}>{MESECI[m]} {m >= 9 ? pocetnaGodina : pocetnaGodina + 1}</option>))}
            </select>
          </div>
          <button onClick={generisiPodsetnik} style={dugme('outline-black', 'md')}>Generiši</button>
        </div>

        {tekstPodsetnik && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500, marginBottom: 4 }}>Grupna poruka (za Viber grupu):</div>
            <textarea value={tekstPodsetnik} onChange={(e) => setTekstPodsetnik(e.target.value)} style={{ ...oblastText, minHeight: 130 }} />
            <button onClick={() => kopiraj(tekstPodsetnik, 'podsetnik')} style={{ ...dugme('brand', 'md'), marginTop: 8 }}>{oznaka('podsetnik')}</button>

            <div style={{ fontSize: 13, fontWeight: 800, margin: '16px 0 6px' }}>Dužnici za {MESECI[mesec]} ({duznici.length}) — privatne poruke</div>
            {duznici.length === 0 ? (
              <p style={{ fontSize: 13, fontWeight: 700, color: T.boja.green700 }}>Nema dužnika za ovaj mesec.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {duznici.map((d, i) => (
                  <div key={i} style={{ border: `1px solid ${T.boja.edge}`, borderRadius: 14, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{d.naziv}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>duguje {formatRSD(d.preostalo)}{d.telefon ? ` · ${d.telefon}` : ' · nema telefona'}</div>
                    </div>
                    <button onClick={() => kopiraj(porukaDuzniku(d), 'd' + i)} style={dugme('outline-black', 'sm')}>{oznaka('d' + i)}</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <p style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500, marginTop: 12 }}>
        Napomena: grupne poruke idu u Viber grupu, a privatne poruke dužnicima šalji pojedinačno.
      </p>
    </div>
  )
}
