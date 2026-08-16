import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'
import { T, dugme, polje, labela } from '../../lib/tema'

type Cenovnik = { iznos_1_dete: number; iznos_2_dete: number; iznos_3plus: number }
type Porodica = { id: string; prezime: string; clanovi: { id: string; ime: string; datum_rodjenja: string | null }[] }
type ZaduzenjeInfo = { id: string; iznos_ukupno: number; uplaceno: number }
type IstorijaZapis = { period: string; iznos_ukupno: number; uplate: { iznos: number; datum: string; nacin: string | null }[] }
type Trener = { id: string; ime: string }

const MESECI: Record<number, string> = {
  1: 'Januar', 2: 'Februar', 3: 'Mart', 4: 'April', 5: 'Maj', 6: 'Jun',
  7: 'Jul', 8: 'Avgust', 9: 'Septembar', 10: 'Oktobar', 11: 'Novembar', 12: 'Decembar',
}

function nazivPorodice(p: Porodica): string {
  const imena = [...p.clanovi].sort((a, b) => (a.datum_rodjenja ?? '').localeCompare(b.datum_rodjenja ?? '')).map((d) => d.ime)
  return imena.length ? `${p.prezime} (${imena.join(', ')})` : p.prezime
}
function formatRSD(n: number): string { return new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 0 }).format(n) + ' RSD' }
function formatDatum(d: string | null): string { if (!d) return ''; const [g, m, dan] = d.split('-'); return `${dan}.${m}.${g}.` }
function mesecIzPerioda(period: string): string { const [g, m] = period.split('-'); return `${MESECI[Number(m)]} ${g}` }
function danasLokalno(): string { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }

const karta: React.CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 14, padding: 14 }
const pilula = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 99, background: bg, color: fg, display: 'inline-block' })

export default function ClanarineScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [pocetnaGodina, setPocetnaGodina] = useState<number>(new Date().getFullYear())
  const [meseci, setMeseci] = useState<number[]>([9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7])
  const [izabraniMesec, setIzabraniMesec] = useState<number>(9)
  const [cenovnik, setCenovnik] = useState<Cenovnik | null>(null)
  const [porodice, setPorodice] = useState<Porodica[]>([])
  const [brojDece, setBrojDece] = useState<Record<string, number>>({})
  const [zaduzenja, setZaduzenja] = useState<Record<string, ZaduzenjeInfo>>({})
  const [treneri, setTreneri] = useState<Trener[]>([])
  const [poruka, setPoruka] = useState<{ tip: 'greska' | 'uspeh'; tekst: string } | null>(null)
  const [radi, setRadi] = useState(false)
  const [unosId, setUnosId] = useState<string | null>(null)
  const [iznosUplate, setIznosUplate] = useState('')
  const [nacin, setNacin] = useState<'gotovina' | 'transfer'>('gotovina')
  const [primioId, setPrimioId] = useState('')
  const [samoDuznici, setSamoDuznici] = useState(false)
  const [pretraga, setPretraga] = useState('')
  const [istorijaId, setIstorijaId] = useState<string | null>(null)
  const [istorija, setIstorija] = useState<IstorijaZapis[]>([])
  const [istorijaRadi, setIstorijaRadi] = useState(false)

  function periodString(mesec: number): string {
    const godina = mesec >= 9 ? pocetnaGodina : pocetnaGodina + 1
    return `${godina}-${String(mesec).padStart(2, '0')}-01`
  }
  function iznosZaBroj(n: number): number {
    if (!cenovnik || n <= 0) return 0
    let s = 0
    if (n >= 1) s += Number(cenovnik.iznos_1_dete)
    if (n >= 2) s += Number(cenovnik.iznos_2_dete)
    if (n >= 3) s += Number(cenovnik.iznos_3plus) * (n - 2)
    return s
  }

  async function ucitajOsnovu() {
    const { data: sez } = await supabase.from('sezone').select('id, datum_od').eq('aktivna', true).maybeSingle()
    const sid = (sez as any)?.id ?? null
    setSezonaId(sid)
    if (!sid) return
    const pg = (sez as any).datum_od ? new Date((sez as any).datum_od).getFullYear() : new Date().getFullYear()
    setPocetnaGodina(pg)
    const { data: cen } = await supabase.from('cenovnik').select('iznos_1_dete, iznos_2_dete, iznos_3plus').eq('sezona_id', sid).order('vazi_od', { ascending: false }).limit(1).maybeSingle()
    setCenovnik((cen as any) ?? null)
    const { data: np } = await supabase.from('naplatni_period').select('meseci').eq('sezona_id', sid).is('grupa_id', null).maybeSingle()
    if ((np as any)?.meseci?.length) setMeseci((np as any).meseci)
    const { data: tr } = await supabase.from('treneri').select('id, ime').eq('aktivan', true).order('ime')
    setTreneri((tr as any) ?? [])
    const { data: por } = await supabase.from('porodice').select('id, prezime, clanovi(id, ime, datum_rodjenja)').order('prezime')
    setPorodice((por as any) ?? [])
    const { data: clanstvo } = await supabase.from('clanstvo').select('clan_id').eq('sezona_id', sid).eq('maticno', true).is('datum_do', null)
    const upisani = new Set(((clanstvo as any[]) ?? []).map((c) => c.clan_id))
    const { data: clanovi } = await supabase.from('clanovi').select('id, porodica_id, status')
    const brojMap: Record<string, number> = {}
    for (const c of (clanovi as any[]) ?? []) {
      if (c.status === 'aktivan' && upisani.has(c.id)) brojMap[c.porodica_id] = (brojMap[c.porodica_id] ?? 0) + 1
    }
    setBrojDece(brojMap)
  }

  async function ucitajZaduzenja(mesec: number, sid: string) {
    const { data } = await supabase.from('zaduzenja').select('id, porodica_id, iznos_ukupno, uplate(iznos)').eq('sezona_id', sid).eq('period', periodString(mesec))
    const map: Record<string, ZaduzenjeInfo> = {}
    for (const z of (data as any[]) ?? []) {
      const uplaceno = (z.uplate ?? []).reduce((s: number, u: any) => s + Number(u.iznos), 0)
      map[z.porodica_id] = { id: z.id, iznos_ukupno: Number(z.iznos_ukupno), uplaceno }
    }
    setZaduzenja(map)
  }

  useEffect(() => { ucitajOsnovu() }, [])
  useEffect(() => {
    if (sezonaId) ucitajZaduzenja(izabraniMesec, sezonaId)
    setIstorijaId(null)
    setUnosId(null)
  }, [sezonaId, izabraniMesec, pocetnaGodina])

  async function dodajTrenera() {
    const ime = window.prompt('Ime trenera:')
    if (!ime || !ime.trim()) return
    const { data, error } = await supabase.from('treneri').insert({ ime: ime.trim() }).select('id, ime').single()
    if (error) { setPoruka({ tip: 'greska', tekst: 'Greška: ' + error.message }); return }
    setTreneri([...treneri, data as any].sort((a, b) => a.ime.localeCompare(b.ime)))
    return (data as any).id as string
  }

  async function ucitajIstoriju(pid: string) {
    if (istorijaId === pid) { setIstorijaId(null); return }
    if (!sezonaId) return
    setIstorijaRadi(true)
    setIstorijaId(pid)
    const { data } = await supabase.from('zaduzenja').select('period, iznos_ukupno, uplate(iznos, datum, nacin)').eq('porodica_id', pid).eq('sezona_id', sezonaId).order('period')
    setIstorija((data as any) ?? [])
    setIstorijaRadi(false)
  }

  async function evidentirajUplatu(p: Porodica) {
    setPoruka(null)
    if (!sezonaId) return
    const suma = Number(iznosUplate.replace(',', '.'))
    if (!suma || suma <= 0) { setPoruka({ tip: 'greska', tekst: 'Unesi ispravan iznos uplate.' }); return }
    const n = brojDece[p.id] ?? 0
    const mesecni = iznosZaBroj(n)
    setRadi(true)
    try {
      let z = zaduzenja[p.id]
      let zid = z?.id
      const ukupno = z?.iznos_ukupno ?? mesecni
      if (!zid) {
        const { data: novo, error } = await supabase.from('zaduzenja').insert({ porodica_id: p.id, sezona_id: sezonaId, period: periodString(izabraniMesec), iznos_ukupno: mesecni, broj_dece_obracun: n }).select('id').single()
        if (error) throw error
        zid = (novo as any).id
      }
      const { error: eU } = await supabase.from('uplate').insert({ zaduzenje_id: zid, iznos: suma, datum: danasLokalno(), nacin, primio_trener_id: primioId || null })
      if (eU) throw eU
      const uplacenoNovo = (z?.uplaceno ?? 0) + suma
      const status = uplacenoNovo >= ukupno ? 'placeno' : uplacenoNovo > 0 ? 'delimicno' : 'neplaceno'
      await supabase.from('zaduzenja').update({ status }).eq('id', zid)
      setUnosId(null)
      setIznosUplate('')
      const primioIme = treneri.find((t) => t.id === primioId)?.ime
      setPoruka({ tip: 'uspeh', tekst: `Uplata za ${nazivPorodice(p)} je evidentirana${primioIme ? ` (primio: ${primioIme})` : ''}.` })
      await ucitajZaduzenja(izabraniMesec, sezonaId)
      if (istorijaId === p.id) setIstorijaId(null)
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) })
    } finally {
      setRadi(false)
    }
  }

  const naplative = porodice.filter((p) => (brojDece[p.id] ?? 0) > 0)
  const redovi = naplative.map((p) => {
    const n = brojDece[p.id] ?? 0
    const z = zaduzenja[p.id]
    const ukupno = z?.iznos_ukupno ?? iznosZaBroj(n)
    const uplaceno = z?.uplaceno ?? 0
    const preostalo = Math.max(ukupno - uplaceno, 0)
    let statusTekst = 'Neplaćeno'
    if (uplaceno >= ukupno && ukupno > 0) statusTekst = 'Plaćeno'
    else if (uplaceno > 0) statusTekst = 'Delimično'
    return { p, n, ukupno, uplaceno, preostalo, statusTekst }
  })
  const q = pretraga.trim().toLowerCase()
  let prikazani = samoDuznici ? redovi.filter((r) => r.preostalo > 0) : redovi
  if (q) prikazani = prikazani.filter((r) => nazivPorodice(r.p).toLowerCase().includes(q))

  const ukOcekivano = redovi.reduce((s, r) => s + r.ukupno, 0)
  const ukNaplaceno = redovi.reduce((s, r) => s + r.uplaceno, 0)
  const ukDug = ukOcekivano - ukNaplaceno

  function izvezi() {
    const godina = izabraniMesec >= 9 ? pocetnaGodina : pocetnaGodina + 1
    const podaci = prikazani.map((r) => ({ Porodica: nazivPorodice(r.p), 'Broj dece': r.n, 'Mesečni iznos': r.ukupno, 'Uplaćeno': r.uplaceno, Dug: r.preostalo, Status: r.statusTekst }))
    const ws = XLSX.utils.json_to_sheet(podaci)
    ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${MESECI[izabraniMesec]} ${godina}`)
    XLSX.writeFile(wb, `Clanarine_${MESECI[izabraniMesec]}_${godina}.xlsx`)
  }

  function statusPilula(placeno: number, ukupno: number) {
    if (placeno >= ukupno && ukupno > 0) return <span style={pilula(T.boja.greenBg, T.boja.green700)}>Plaćeno</span>
    if (placeno > 0) return <span style={pilula(T.boja.pill, T.boja.pillText)}>Delimično</span>
    return <span style={pilula(T.boja.redBg, T.boja.red)}>Dug</span>
  }

  function pocniUnos(preostalo: number) {
    setIznosUplate(String(preostalo))
    setPoruka(null)
  }

  const cip = (aktivan: boolean): React.CSSProperties => ({ fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 99, cursor: 'pointer', border: `1px solid ${aktivan ? T.boja.ink : T.boja.edge}`, background: aktivan ? T.boja.ink : '#fff', color: aktivan ? '#fff' : T.boja.ink600 })

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>Članarine</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Sezona 2026/2027</div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ minWidth: 180 }}>
          <label style={labela}>Mesec</label>
          <select style={polje} value={izabraniMesec} onChange={(e) => setIzabraniMesec(Number(e.target.value))}>
            {meseci.map((m) => (<option key={m} value={m}>{MESECI[m]} {m >= 9 ? pocetnaGodina : pocetnaGodina + 1}</option>))}
          </select>
        </div>
        <button onClick={izvezi} style={{ ...dugme('outline-black', 'md'), marginLeft: 'auto' }}>Izvezi u Excel</button>
      </div>

      <input style={{ ...polje, marginBottom: 12 }} value={pretraga} onChange={(e) => setPretraga(e.target.value)} placeholder="Pretraga porodice po imenu..." />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setSamoDuznici(false)} style={cip(!samoDuznici)}>Svi</button>
        <button onClick={() => setSamoDuznici(true)} style={cip(samoDuznici)}>Duguju</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { l: 'Očekivano', v: ukOcekivano, c: T.boja.ink },
          { l: 'Naplaćeno', v: ukNaplaceno, c: T.boja.green700 },
          { l: 'Dug', v: ukDug, c: T.boja.red },
        ].map((k) => (
          <div key={k.l} style={{ ...karta, flex: 1, minWidth: 120, borderRadius: 16, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>{k.l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.c, marginTop: 2 }}>{formatRSD(k.v)}</div>
          </div>
        ))}
      </div>

      {poruka && (<p style={{ fontSize: 14, fontWeight: 700, color: poruka.tip === 'greska' ? T.boja.red : T.boja.green700 }}>{poruka.tekst}</p>)}

      {prikazani.length === 0 ? (
        <p style={{ color: T.boja.ink500, fontSize: 14, fontWeight: 600 }}>
          {naplative.length === 0 ? 'Nema porodica sa upisanom decom. Prvo upiši decu u grupe na ekranu „Porodice".' : samoDuznici ? 'Nema dužnika za ovaj mesec.' : 'Nema rezultata.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {prikazani.map((r) => {
            const p = r.p
            return (
              <div key={p.id} style={karta}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{nazivPorodice(p)}</div>
                    <div style={{ color: T.boja.ink500, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                      {r.n} {r.n === 1 ? 'dete' : 'dece'} · {formatRSD(r.ukupno)}{r.uplaceno > 0 ? ` · uplaćeno ${formatRSD(r.uplaceno)}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {statusPilula(r.uplaceno, r.ukupno)}
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.boja.red, marginTop: 4 }}>
                      {r.preostalo > 0 ? `duguje ${formatRSD(r.preostalo)}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {r.preostalo > 0 && unosId !== p.id && (
                    <button onClick={() => { setUnosId(p.id); pocniUnos(r.preostalo) }} style={dugme('brand', 'sm')}>+ Naplati</button>
                  )}
                  <button onClick={() => ucitajIstoriju(p.id)} style={dugme('ghost-black', 'sm')}>{istorijaId === p.id ? 'Sakrij istoriju' : 'Istorija'}</button>
                </div>

                {unosId === p.id && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${T.boja.edge}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <label style={labela}>Iznos (RSD)</label>
                        <input style={polje} value={iznosUplate} onChange={(e) => setIznosUplate(e.target.value)} inputMode="numeric" />
                      </div>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <label style={labela}>Ko je primio</label>
                        <select style={polje} value={primioId} onChange={async (e) => { if (e.target.value === '__novi__') { const id = await dodajTrenera(); if (id) setPrimioId(id) } else setPrimioId(e.target.value) }}>
                          <option value="">— izaberi —</option>
                          {treneri.map((t) => (<option key={t.id} value={t.id}>{t.ime}</option>))}
                          <option value="__novi__">+ dodaj trenera…</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={labela}>Način</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setNacin('gotovina')} style={cip(nacin === 'gotovina')}>Gotovina</button>
                        <button onClick={() => setNacin('transfer')} style={cip(nacin === 'transfer')}>Uplata na račun</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => evidentirajUplatu(p)} disabled={radi} style={{ ...dugme('brand', 'md'), flex: 1 }}>{radi ? 'Čuvam...' : 'Sačuvaj uplatu'}</button>
                      <button onClick={() => { setUnosId(null); setIznosUplate('') }} style={dugme('ghost-black', 'md')}>Otkaži</button>
                    </div>
                  </div>
                )}

                {istorijaId === p.id && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${T.boja.edge}`, paddingTop: 10 }}>
                    {istorijaRadi ? (
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Učitavam...</div>
                    ) : istorija.length === 0 ? (
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Nema evidentiranih uplata u ovoj sezoni.</div>
                    ) : (
                      istorija.map((z) => (
                        <div key={z.period} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 800 }}>{mesecIzPerioda(z.period)} — {formatRSD(Number(z.iznos_ukupno))}</div>
                          {z.uplate.length === 0 ? (
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.red, marginLeft: 8 }}>nije plaćeno</div>
                          ) : (
                            z.uplate.map((u, idx) => (
                              <div key={idx} style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500, marginLeft: 8 }}>
                                {formatDatum(u.datum)} · {formatRSD(Number(u.iznos))}{u.nacin ? ` · ${u.nacin === 'transfer' ? 'račun' : 'gotovina'}` : ''}
                              </div>
                            ))
                          )}
                        </div>
                      ))
                    )}
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
