import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { T, dugme } from '../../lib/tema'

type Grupa = { id: string; naziv: string; tip: string; uzrast_oznaka: string | null }
type UvozDete = { ime: string; datum_rodjenja: string | null; grupa_id: string | null }
type UvozPorodica = { prezime: string; otac_ime: string; majka_ime: string; telefon: string; deca: UvozDete[] }
type Rezultat = { porodice: UvozPorodica[]; brojDece: number; upozorenja: string[] }

function normalize(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}
function labelaGrupe(g: Grupa): string {
  return g.uzrast_oznaka ? `${g.naziv} ${g.uzrast_oznaka}` : g.naziv
}
function normDatum(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) {
    const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000)
    return d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}
function polje(row: Record<string, any>, kandidati: string[]): string {
  for (const k of Object.keys(row)) {
    if (kandidati.includes(normalize(k))) return String(row[k] ?? '').trim()
  }
  return ''
}

const karta: React.CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 16, padding: 16, marginTop: 12 }

export default function UvozScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [grupe, setGrupe] = useState<Grupa[]>([])
  const [rezultat, setRezultat] = useState<Rezultat | null>(null)
  const [imeFajla, setImeFajla] = useState('')
  const [poruka, setPoruka] = useState<{ tip: 'greska' | 'uspeh'; tekst: string } | null>(null)
  const [radi, setRadi] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: sez } = await supabase.from('sezone').select('id').eq('aktivna', true).maybeSingle()
      const sid = (sez as any)?.id ?? null
      setSezonaId(sid)
      if (sid) {
        const { data: g } = await supabase.from('grupe').select('id, naziv, tip, uzrast_oznaka').eq('sezona_id', sid).order('tip').order('naziv')
        setGrupe((g as any) ?? [])
      }
    })()
  }, [])

  function preuzmiSablon() {
    const zaglavlje = ['Šifra porodice', 'Prezime', 'Ime deteta', 'Datum rođenja', 'Grupa', 'Ime oca', 'Ime majke', 'Telefon']
    const primeri = [
      ['1', 'Vidović', 'Luka', '2016-05-10', 'Pioniri U14', 'Marko', 'Jelena', '064111222'],
      ['1', 'Vidović', 'Ana', '2018-09-01', 'Mlađi pioniri U12', 'Marko', 'Jelena', '064111222'],
      ['2', 'Jovanović', 'Petar', '2015-03-20', 'Pioniri U15', '', '', ''],
    ]
    const ws = XLSX.utils.aoa_to_sheet([zaglavlje, ...primeri])
    ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Podaci')
    const grupeAoa = [['Dozvoljeni nazivi grupa (kopiraj tačno u kolonu „Grupa")'], ...grupe.map((g) => [labelaGrupe(g)])]
    const wsG = XLSX.utils.aoa_to_sheet(grupeAoa)
    wsG['!cols'] = [{ wch: 44 }]
    XLSX.utils.book_append_sheet(wb, wsG, 'Grupe')
    XLSX.writeFile(wb, 'Asist_sablon_uvoz.xlsx')
  }

  async function izaberiFajl(e: React.ChangeEvent<HTMLInputElement>) {
    setPoruka(null)
    setRezultat(null)
    const file = e.target.files?.[0]
    if (!file) return
    setImeFajla(file.name)
    const grupaMap = new Map<string, string>()
    for (const g of grupe) grupaMap.set(normalize(labelaGrupe(g)), g.id)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })
      const grupe_por_sifri = new Map<string, UvozPorodica>()
      const upozorenja: string[] = []
      let brojDece = 0
      rows.forEach((row, i) => {
        const prezime = polje(row, ['prezime'])
        const ime = polje(row, ['ime deteta', 'ime'])
        const sifra = polje(row, ['šifra porodice', 'sifra porodice', 'porodica', 'šifra', 'sifra'])
        if (!prezime && !ime) return
        if (!ime) { upozorenja.push(`Red ${i + 2}: nema imena deteta — preskočeno.`); return }
        if (!prezime) { upozorenja.push(`Red ${i + 2}: nema prezimena — preskočeno.`); return }
        const kljuc = sifra ? `s:${sifra}` : `r:${i}`
        let por = grupe_por_sifri.get(kljuc)
        if (!por) {
          por = { prezime, otac_ime: polje(row, ['ime oca', 'otac']), majka_ime: polje(row, ['ime majke', 'majka']), telefon: polje(row, ['telefon', 'tel']), deca: [] }
          grupe_por_sifri.set(kljuc, por)
        }
        const grupaTekst = polje(row, ['grupa'])
        let grupa_id: string | null = null
        if (grupaTekst) {
          grupa_id = grupaMap.get(normalize(grupaTekst)) ?? null
          if (!grupa_id) upozorenja.push(`Red ${i + 2}: nepoznata grupa „${grupaTekst}" — dete uneto bez grupe.`)
        }
        por.deca.push({ ime, datum_rodjenja: normDatum(polje(row, ['datum rođenja', 'datum rodjenja', 'datum'])), grupa_id })
        brojDece++
      })
      const porodice = [...grupe_por_sifri.values()]
      if (porodice.length === 0) {
        setPoruka({ tip: 'greska', tekst: 'U fajlu nema upotrebljivih redova. Proveri da si koristio šablon.' })
        return
      }
      setRezultat({ porodice, brojDece, upozorenja })
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška pri čitanju fajla: ' + (err.message ?? String(err)) })
    }
  }

  async function uvezi() {
    if (!rezultat || !sezonaId) return
    setRadi(true)
    setPoruka(null)
    try {
      const porodiceIns: any[] = []
      const clanoviIns: any[] = []
      const clanstvoIns: any[] = []
      for (const p of rezultat.porodice) {
        const pid = crypto.randomUUID()
        porodiceIns.push({ id: pid, prezime: p.prezime, otac_ime: p.otac_ime || null, majka_ime: p.majka_ime || null, telefon: p.telefon || null })
        for (const d of p.deca) {
          const cid = crypto.randomUUID()
          clanoviIns.push({ id: cid, porodica_id: pid, ime: d.ime, datum_rodjenja: d.datum_rodjenja })
          if (d.grupa_id) clanstvoIns.push({ clan_id: cid, grupa_id: d.grupa_id, sezona_id: sezonaId, maticno: true })
        }
      }
      const { error: e1 } = await supabase.from('porodice').insert(porodiceIns)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('clanovi').insert(clanoviIns)
      if (e2) throw e2
      if (clanstvoIns.length) {
        const { error: e3 } = await supabase.from('clanstvo').insert(clanstvoIns)
        if (e3) throw e3
      }
      setPoruka({ tip: 'uspeh', tekst: `Uspešno uvezeno: ${porodiceIns.length} porodica i ${clanoviIns.length} dece. Pogledaj tab „Porodice".` })
      setRezultat(null)
      setImeFajla('')
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška pri uvozu: ' + (err.message ?? String(err)) })
    } finally {
      setRadi(false)
    }
  }

  const korak = (n: number, aktivan: boolean) => (
    <div style={{ width: 26, height: 26, flex: '0 0 26px', borderRadius: 99, background: aktivan ? T.boja.brand : T.boja.fill, color: aktivan ? '#fff' : T.boja.ink400, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{n}</div>
  )

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>Uvoz iz Excel-a</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Za inicijalni upis celog kluba odjednom.</div>
      </div>

      <div style={karta}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {korak(1, true)}
          <div style={{ fontSize: 15, fontWeight: 800 }}>Preuzmi šablon</div>
        </div>
        <p style={{ color: T.boja.ink500, fontSize: 13, fontWeight: 600, marginTop: 0 }}>
          Jedan red = jedno dete. Braću/sestre povezuješ istom „Šifrom porodice" (bilo koji broj/oznaka). Kolonu „Grupa" popuni tačnim nazivom iz lista „Grupe" u šablonu.
        </p>
        <button onClick={preuzmiSablon} style={dugme('outline-black', 'md')}>Preuzmi šablon (Excel)</button>
      </div>

      <div style={karta}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {korak(2, !!imeFajla)}
          <div style={{ fontSize: 15, fontWeight: 800 }}>Učitaj popunjen fajl</div>
        </div>
        <input type="file" accept=".xlsx,.xls" onChange={izaberiFajl} style={{ fontSize: 14, fontFamily: 'inherit' }} />
        {imeFajla && <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500, marginTop: 6 }}>Fajl: {imeFajla}</div>}
      </div>

      {poruka && (
        <p style={{ fontSize: 14, fontWeight: 700, color: poruka.tip === 'greska' ? T.boja.red : T.boja.green700, marginTop: 12 }}>{poruka.tekst}</p>
      )}

      {rezultat && (
        <div style={{ ...karta, borderColor: T.boja.brand }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {korak(3, true)}
            <div style={{ fontSize: 15, fontWeight: 800 }}>Pregled pre uvoza</div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120, background: T.boja.greenBg, borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.boja.green700 }}>Porodica</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.boja.green700 }}>{rezultat.porodice.length}</div>
            </div>
            <div style={{ flex: 1, minWidth: 120, background: T.boja.fill, borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.boja.ink600 }}>Dece</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{rezultat.brojDece}</div>
            </div>
          </div>

          {rezultat.upozorenja.length > 0 && (
            <div style={{ background: T.boja.yellowBg, border: `1px solid ${T.boja.pillEdge}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.boja.yellow }}>Upozorenja ({rezultat.upozorenja.length}):</div>
              <div style={{ maxHeight: 160, overflowY: 'auto', fontSize: 13, fontWeight: 600, color: T.boja.ink600, marginTop: 4 }}>
                {rezultat.upozorenja.map((u, i) => (<div key={i}>• {u}</div>))}
              </div>
            </div>
          )}

          <button onClick={uvezi} disabled={radi} style={{ ...dugme('brand', 'md'), width: '100%', opacity: radi ? 0.6 : 1 }}>
            {radi ? 'Uvozim...' : `Uvezi ${rezultat.porodice.length} porodica`}
          </button>
        </div>
      )}
    </div>
  )
}
