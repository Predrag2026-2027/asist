import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { T, dugme, pragBoja } from '../../lib/tema'

type Props = { onNavigate: (t: string) => void }
type Trening = { id: string; vreme: string | null; mesto: string | null; status: string; naziv: string; prisutno: number; ukupno: number }
type Dug = { naziv: string; preostalo: number }

const MESECI = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar']
const STATUS: Record<string, { l: string; bg: string; fg: string }> = {
  planiran: { l: 'Zakazano', bg: T.boja.fill, fg: T.boja.ink600 },
  odrzan: { l: 'Evidentirano', bg: T.boja.greenBg, fg: T.boja.green700 },
  otkazan: { l: 'Otkazan', bg: T.boja.redBg, fg: T.boja.red },
}

function fmt(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
function rsd(n: number) { return new Intl.NumberFormat('sr-RS').format(n) + ' RSD' }

export default function DanasScreen({ onNavigate }: Props) {
  const [treninzi, setTreninzi] = useState<Trening[]>([])
  const [dugovi, setDugovi] = useState<Dug[]>([])
  const [brojDugova, setBrojDugova] = useState(0)
  const [naplaceno, setNaplaceno] = useState(0)
  const [aktivnih, setAktivnih] = useState(0)
  const [prisutno, setPrisutno] = useState<{ p: number; u: number }>({ p: 0, u: 0 })
  const [ucitava, setUcitava] = useState(true)
  const danas = new Date()

  useEffect(() => { ucitaj() }, [])

  async function ucitaj() {
    setUcitava(true)
    const { data: sez } = await supabase.from('sezone').select('id, datum_od').eq('aktivna', true).maybeSingle()
    const s = sez as any
    if (!s) { setUcitava(false); return }
    const sid = s.id
    const dToday = fmt(danas)
    const startYear = s.datum_od ? new Date(s.datum_od).getFullYear() : danas.getFullYear()
    const mNum = danas.getMonth() + 1
    const godina = mNum >= 9 ? startYear : startYear + 1
    const period = `${godina}-${String(mNum).padStart(2, '0')}-01`
    const lastDay = new Date(godina, mNum, 0).getDate()
    const periodEnd = `${godina}-${String(mNum).padStart(2, '0')}-${lastDay}`

    const { data: grupeData } = await supabase.from('grupe').select('id, naziv, uzrast_oznaka').eq('sezona_id', sid)
    const grupaMap = new Map((grupeData as any[] ?? []).map((g) => [g.id, g]))

    const { data: clanstvoData } = await supabase.from('clanstvo').select('clan_id, grupa_id').eq('sezona_id', sid).eq('maticno', true).is('datum_do', null)
    const { data: clanoviData } = await supabase.from('clanovi').select('id, porodica_id, status')
    const clanMap = new Map((clanoviData as any[] ?? []).map((c) => [c.id, c]))
    setAktivnih((clanoviData as any[] ?? []).filter((c) => c.status === 'aktivan').length)

    const brojPoPorodici: Record<string, number> = {}
    const enrolledPoGrupi: Record<string, number> = {}
    for (const cs of (clanstvoData as any[] ?? [])) {
      const c: any = clanMap.get(cs.clan_id)
      if (c && c.status === 'aktivan') {
        brojPoPorodici[c.porodica_id] = (brojPoPorodici[c.porodica_id] ?? 0) + 1
        enrolledPoGrupi[cs.grupa_id] = (enrolledPoGrupi[cs.grupa_id] ?? 0) + 1
      }
    }

    const { data: trData } = await supabase.from('treninzi').select('id, grupa_id, vreme, mesto, status').eq('sezona_id', sid).eq('datum', dToday).order('vreme')
    const todayList = (trData as any[]) ?? []
    const todayIds = todayList.map((t) => t.id)
    const presentCount: Record<string, number> = {}
    if (todayIds.length) {
      const { data: pr } = await supabase.from('prisustvo').select('trening_id').in('trening_id', todayIds).eq('prisutan', true)
      for (const r of (pr as any[] ?? [])) presentCount[r.trening_id] = (presentCount[r.trening_id] ?? 0) + 1
    }
    let pSum = 0, uSum = 0
    const puni: Trening[] = todayList.map((t) => {
      const g: any = grupaMap.get(t.grupa_id)
      const ukupno = enrolledPoGrupi[t.grupa_id] ?? 0
      const prisutnoN = presentCount[t.id] ?? 0
      if (t.status === 'odrzan') { pSum += prisutnoN; uSum += ukupno }
      return { id: t.id, vreme: t.vreme, mesto: t.mesto, status: t.status, naziv: g ? (g.uzrast_oznaka ? `${g.naziv} ${g.uzrast_oznaka}` : g.naziv) : 'Grupa', prisutno: prisutnoN, ukupno }
    })
    setTreninzi(puni)
    setPrisutno({ p: pSum, u: uSum })

    const { data: cen } = await supabase.from('cenovnik').select('iznos_1_dete, iznos_2_dete, iznos_3plus').eq('sezona_id', sid).order('vazi_od', { ascending: false }).limit(1).maybeSingle()
    const c: any = cen
    const tier = (n: number) => { if (!c || n <= 0) return 0; let x = 0; if (n >= 1) x += Number(c.iznos_1_dete); if (n >= 2) x += Number(c.iznos_2_dete); if (n >= 3) x += Number(c.iznos_3plus) * (n - 2); return x }

    const { data: por } = await supabase.from('porodice').select('id, prezime, clanovi(ime, datum_rodjenja)').order('prezime')
    const { data: zad } = await supabase.from('zaduzenja').select('porodica_id, iznos_ukupno, uplate(iznos)').eq('sezona_id', sid).eq('period', period)
    const zMap: Record<string, { uk: number; up: number }> = {}
    for (const z of (zad as any[] ?? [])) { const up = (z.uplate ?? []).reduce((a: number, u: any) => a + Number(u.iznos), 0); zMap[z.porodica_id] = { uk: Number(z.iznos_ukupno), up } }
    const lista: Dug[] = []
    for (const p of (por as any[] ?? [])) {
      const n = brojPoPorodici[p.id] ?? 0
      if (n === 0) continue
      const z = zMap[p.id]
      const uk = z?.uk ?? tier(n)
      const up = z?.up ?? 0
      const preostalo = uk - up
      if (preostalo > 0) {
        const imena = [...p.clanovi].sort((a: any, b: any) => (a.datum_rodjenja ?? '').localeCompare(b.datum_rodjenja ?? '')).map((d: any) => d.ime)
        lista.push({ naziv: `${p.prezime} (${imena.join(', ')})`, preostalo })
      }
    }
    lista.sort((a, b) => b.preostalo - a.preostalo)
    setBrojDugova(lista.length)
    setDugovi(lista.slice(0, 3))

    const { data: up } = await supabase.from('uplate').select('iznos, datum, zaduzenja!inner(sezona_id)').eq('zaduzenja.sezona_id', sid).gte('datum', period).lte('datum', periodEnd).range(0, 9999)
    setNaplaceno((up as any[] ?? []).reduce((a, u) => a + Number(u.iznos), 0))

    setUcitava(false)
  }

  const kpi = [
    { l: 'Prisutno danas', v: prisutno.u > 0 ? `${prisutno.p}/${prisutno.u}` : '—', c: T.boja.ink },
    { l: 'Dugovi ovog meseca', v: String(brojDugova), c: T.boja.brand },
    { l: `Naplaćeno u ${MESECI[danas.getMonth()]}u`, v: rsd(naplaceno), c: T.boja.ink },
    { l: 'Aktivnih članova', v: String(aktivnih), c: T.boja.ink },
  ]

  const kartaStil: React.CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 16, padding: 16 }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>Danas · {danas.getDate()}. {MESECI[danas.getMonth()]}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500 }}>Šta se dešava danas i šta traži tvoju reakciju.</div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        {kpi.map((k) => (
          <div key={k.l} style={{ ...kartaStil, flex: 1, minWidth: 150, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>{k.l}</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: k.c, marginTop: 2 }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 340px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Raspored za danas</div>
          {ucitava ? (
            <div style={{ color: T.boja.ink500, fontSize: 14 }}>Učitavam...</div>
          ) : treninzi.length === 0 ? (
            <div style={{ ...kartaStil, textAlign: 'center', padding: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Danas nema treninga</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.ink500, marginBottom: 14 }}>Zakaži prvi trening da započneš dan.</div>
              <button onClick={() => onNavigate('treninzi')} style={dugme('brand', 'md')}>Zakaži trening</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {treninzi.map((t) => {
                const st = STATUS[t.status] ?? STATUS.planiran
                return (
                  <div key={t.id} style={{ ...kartaStil, borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 62, flex: '0 0 62px', padding: '8px 0', borderRadius: 11, background: T.boja.fill, textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{t.vreme ? t.vreme.slice(0, 5) : '--:--'}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{t.naziv}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.boja.ink500 }}>
                        {[t.mesto, t.ukupno ? `${t.prisutno}/${t.ukupno} prisutno` : null].filter(Boolean).join(' · ') || 'bez detalja'}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 99, background: st.bg, color: st.fg }}>{st.l}</span>
                    <button onClick={() => onNavigate('treninzi')} style={dugme('outline-black', 'sm')}>Upiši prisustvo</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Traži tvoju pažnju</div>
          <div style={kartaStil}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Dugovi ({brojDugova})</div>
            {dugovi.length === 0 ? (
              <div style={{ fontSize: 13, fontWeight: 600, color: T.boja.green700 }}>Nema dugovanja za ovaj mesec.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {dugovi.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.naziv}</span>
                    <span style={{ fontWeight: 800, color: T.boja.red, whiteSpace: 'nowrap' }}>{rsd(d.preostalo)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onNavigate('obavestenja')} style={dugme('default-black', 'sm')}>Pošalji podsetnik</button>
              <button onClick={() => onNavigate('clanarine')} style={dugme('ghost-black', 'sm')}>Vidi sve</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
