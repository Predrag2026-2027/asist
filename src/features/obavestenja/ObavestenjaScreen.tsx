import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Grupa = { id: string; naziv: string; uzrast_oznaka: string | null }
type Porodica = {
  id: string
  prezime: string
  telefon: string | null
  clanovi: { id: string; ime: string; datum_rodjenja: string | null }[]
}

const boja = {
  tekst: '#1c1c1a',
  meki: '#6b6a64',
  ivica: '#e2e0d8',
  pozadina: '#faf9f5',
  karta: '#ffffff',
  akcenat: '#c2410c',
  uspeh: '#15803d',
}

const MESECI: Record<number, string> = {
  1: 'Januar', 2: 'Februar', 3: 'Mart', 4: 'April', 5: 'Maj', 6: 'Jun',
  7: 'Jul', 8: 'Avgust', 9: 'Septembar', 10: 'Oktobar', 11: 'Novembar', 12: 'Decembar',
}
const DANI_PUN = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja']

function fmt(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
function ddmm(s: string): string {
  const [, m, d] = s.split('-')
  return `${d}.${m}.`
}
function formatRSD(n: number): string {
  return new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 0 }).format(n) + ' RSD'
}
function labelaGrupe(g?: Grupa): string {
  if (!g) return ''
  return g.uzrast_oznaka ? `${g.naziv} ${g.uzrast_oznaka}` : g.naziv
}
function nazivPorodice(p: Porodica): string {
  const imena = [...p.clanovi].sort((a, b) => (a.datum_rodjenja ?? '').localeCompare(b.datum_rodjenja ?? '')).map((d) => d.ime)
  return imena.length ? `${p.prezime} (${imena.join(', ')})` : p.prezime
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

export default function ObavestenjaScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [pocetnaGodina, setPocetnaGodina] = useState(new Date().getFullYear())
  const [grupe, setGrupe] = useState<Grupa[]>([])
  const [porodice, setPorodice] = useState<Porodica[]>([])
  const [brojDece, setBrojDece] = useState<Record<string, number>>({})
  const [cenovnik, setCenovnik] = useState<{ i1: number; i2: number; i3: number } | null>(null)

  const [tip, setTip] = useState<'raspored' | 'clanarina' | 'duznici'>('raspored')
  const [mesec, setMesec] = useState(9)
  const [nedelja, setNedelja] = useState(() => {
    const d = new Date()
    const day = (d.getDay() + 6) % 7
    const m = new Date(d)
    m.setDate(d.getDate() - day)
    return fmt(m)
  })
  const [tekst, setTekst] = useState('')
  const [radi, setRadi] = useState(false)
  const [kopirano, setKopirano] = useState(false)

  const meseci = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]

  useEffect(() => {
    ;(async () => {
      const { data: sez } = await supabase.from('sezone').select('id, datum_od').eq('aktivna', true).maybeSingle()
      const s = sez as any
      if (!s) return
      setSezonaId(s.id)
      setPocetnaGodina(s.datum_od ? new Date(s.datum_od).getFullYear() : new Date().getFullYear())

      const { data: g } = await supabase.from('grupe').select('id, naziv, uzrast_oznaka').eq('sezona_id', s.id)
      setGrupe((g as any) ?? [])

      const { data: cen } = await supabase.from('cenovnik').select('iznos_1_dete, iznos_2_dete, iznos_3plus').eq('sezona_id', s.id).order('vazi_od', { ascending: false }).limit(1).maybeSingle()
      if (cen) setCenovnik({ i1: Number((cen as any).iznos_1_dete), i2: Number((cen as any).iznos_2_dete), i3: Number((cen as any).iznos_3plus) })

      const { data: por } = await supabase.from('porodice').select('id, prezime, telefon, clanovi(id, ime, datum_rodjenja)').order('prezime')
      setPorodice((por as any) ?? [])

      const { data: cl } = await supabase.from('clanstvo').select('clan_id').eq('sezona_id', s.id).eq('maticno', true).is('datum_do', null)
      const upisani = new Set(((cl as any[]) ?? []).map((x) => x.clan_id))
      const { data: clanovi } = await supabase.from('clanovi').select('id, porodica_id, status')
      const bm: Record<string, number> = {}
      for (const c of (clanovi as any[]) ?? []) if (c.status === 'aktivan' && upisani.has(c.id)) bm[c.porodica_id] = (bm[c.porodica_id] ?? 0) + 1
      setBrojDece(bm)
    })()
  }, [])

  function iznosZaBroj(n: number): number {
    if (!cenovnik || n <= 0) return 0
    let s = 0
    if (n >= 1) s += cenovnik.i1
    if (n >= 2) s += cenovnik.i2
    if (n >= 3) s += cenovnik.i3 * (n - 2)
    return s
  }

  async function generisi() {
    setRadi(true)
    setKopirano(false)
    try {
      if (tip === 'clanarina') {
        const g = mesec >= 9 ? pocetnaGodina : pocetnaGodina + 1
        setTekst(
          `Poštovani roditelji,\n\nPodsećamo da je članarina za ${MESECI[mesec]} ${g}. dospela za uplatu. Molimo vas da izmirite obavezu u toku meseca.\n\nHvala na saradnji,\nKK BB Basket`
        )
      } else if (tip === 'raspored') {
        const start = new Date(nedelja + 'T00:00:00')
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        const grupaMap = new Map(grupe.map((x) => [x.id, x]))
        const { data } = await supabase
          .from('treninzi')
          .select('grupa_id, datum, vreme, mesto, status')
          .eq('sezona_id', sezonaId)
          .gte('datum', fmt(start))
          .lte('datum', fmt(end))
          .order('datum')
          .order('vreme')
        const poDanu = new Map<string, any[]>()
        for (const t of (data as any[]) ?? []) {
          const arr = poDanu.get(t.datum) ?? []
          arr.push(t)
          poDanu.set(t.datum, arr)
        }
        let out = `RASPORED TRENINGA (${ddmm(fmt(start))}–${ddmm(fmt(end))})\n`
        let imaTermina = false
        for (let i = 0; i < 7; i++) {
          const dan = new Date(start)
          dan.setDate(start.getDate() + i)
          const key = fmt(dan)
          const lista = poDanu.get(key)
          if (!lista || !lista.length) continue
          imaTermina = true
          out += `\n${DANI_PUN[i]} ${ddmm(key)}\n`
          for (const t of lista) {
            const v = t.vreme ? t.vreme.slice(0, 5) + ' ' : ''
            const m = t.mesto ? ' — ' + t.mesto : ''
            const otk = t.status === 'otkazan' ? ' (OTKAZANO)' : ''
            out += `  ${v}${labelaGrupe(grupaMap.get(t.grupa_id))}${m}${otk}\n`
          }
        }
        if (!imaTermina) out += '\nNema zakazanih treninga za ovu nedelju.\n'
        out += '\nKK BB Basket'
        setTekst(out)
      } else {
        const g = mesec >= 9 ? pocetnaGodina : pocetnaGodina + 1
        const period = `${g}-${String(mesec).padStart(2, '0')}-01`
        const { data: zad } = await supabase.from('zaduzenja').select('porodica_id, iznos_ukupno, uplate(iznos)').eq('sezona_id', sezonaId).eq('period', period)
        const mapZ = new Map<string, { ukupno: number; uplaceno: number }>()
        for (const z of (zad as any[]) ?? []) {
          const upl = (z.uplate ?? []).reduce((s: number, u: any) => s + Number(u.iznos), 0)
          mapZ.set(z.porodica_id, { ukupno: Number(z.iznos_ukupno), uplaceno: upl })
        }
        const duznici: { label: string; dug: number; tel: string | null }[] = []
        for (const p of porodice) {
          const n = brojDece[p.id] ?? 0
          if (n <= 0) continue
          const z = mapZ.get(p.id)
          const ukupno = z?.ukupno ?? iznosZaBroj(n)
          const uplaceno = z?.uplaceno ?? 0
          const dug = ukupno - uplaceno
          if (dug > 0) duznici.push({ label: nazivPorodice(p), dug, tel: p.telefon })
        }
        duznici.sort((a, b) => b.dug - a.dug)
        let out = `DUŽNICI — ${MESECI[mesec]} ${g}.\n\n`
        if (duznici.length === 0) out += 'Nema dužnika za ovaj mesec.'
        else {
          for (const d of duznici) out += `${d.label} — duguje ${formatRSD(d.dug)}${d.tel ? ' (' + d.tel + ')' : ''}\n`
          const ukupanDug = duznici.reduce((s, d) => s + d.dug, 0)
          out += `\nUkupno dužnika: ${duznici.length} · ukupan dug: ${formatRSD(ukupanDug)}`
        }
        setTekst(out)
      }
    } finally {
      setRadi(false)
    }
  }

  async function kopiraj() {
    try {
      await navigator.clipboard.writeText(tekst)
      setKopirano(true)
      setTimeout(() => setKopirano(false), 2000)
    } catch {
      setKopirano(false)
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: boja.pozadina, color: boja.tekst, minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 2px' }}>Obaveštenja</h1>
        <p style={{ color: boja.meki, marginTop: 0, fontSize: 14 }}>Generiši tekst za Viber grupu ili SMS.</p>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 13, color: boja.meki, marginBottom: 4 }}>Vrsta obaveštenja</label>
          <select style={{ ...stilInput, width: '100%' }} value={tip} onChange={(e) => { setTip(e.target.value as any); setTekst('') }}>
            <option value="raspored">Raspored treninga za nedelju (grupno)</option>
            <option value="clanarina">Podsetnik za članarinu (grupno)</option>
            <option value="duznici">Spisak dužnika (za privatne poruke)</option>
          </select>
        </div>

        {tip === 'raspored' ? (
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 13, color: boja.meki, marginBottom: 4 }}>Nedelja počinje (ponedeljak)</label>
            <input type="date" style={{ ...stilInput, width: '100%' }} value={nedelja} onChange={(e) => setNedelja(e.target.value)} />
          </div>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 13, color: boja.meki, marginBottom: 4 }}>Mesec</label>
            <select style={{ ...stilInput, width: '100%' }} value={mesec} onChange={(e) => setMesec(Number(e.target.value))}>
              {meseci.map((m) => (
                <option key={m} value={m}>{MESECI[m]} {m >= 9 ? pocetnaGodina : pocetnaGodina + 1}</option>
              ))}
            </select>
          </div>
        )}

        <button onClick={generisi} disabled={radi} style={{ background: boja.akcenat, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 15, fontWeight: 600, cursor: radi ? 'default' : 'pointer', opacity: radi ? 0.6 : 1 }}>
          {radi ? 'Generišem...' : 'Generiši tekst'}
        </button>

        {tekst && (
          <div style={{ marginTop: 14 }}>
            <textarea
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              style={{ ...stilInput, width: '100%', minHeight: 220, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <button onClick={kopiraj} style={{ background: boja.tekst, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Kopiraj tekst
              </button>
              {kopirano && <span style={{ color: boja.uspeh, fontSize: 14 }}>Kopirano ✓</span>}
            </div>
            <p style={{ fontSize: 12, color: boja.meki, marginTop: 8 }}>
              Tekst možeš izmeniti pre kopiranja. Spisak dužnika je za privatne poruke — ne objavljuj imena u grupi.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
