import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Grupa = {
  id: string
  naziv: string
  tip: string
  uzrast_oznaka: string | null
}

type UnosDeteta = {
  id?: string
  clanstvo_id?: string
  ime: string
  datum_rodjenja: string
  grupa_id: string
}

type PorodicaSaDecom = {
  id: string
  prezime: string
  otac_ime: string | null
  majka_ime: string | null
  telefon: string | null
  clanovi: { id: string; ime: string; datum_rodjenja: string | null }[]
}

function nazivPorodice(p: PorodicaSaDecom): string {
  const imena = [...p.clanovi]
    .sort((a, b) => (a.datum_rodjenja ?? '').localeCompare(b.datum_rodjenja ?? ''))
    .map((d) => d.ime)
  return imena.length ? `${p.prezime} (${imena.join(', ')})` : p.prezime
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

const stilInput: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: `1px solid ${boja.ivica}`,
  borderRadius: 8,
  fontSize: 15,
  boxSizing: 'border-box',
  background: '#fff',
  color: boja.tekst,
}

const stilLabela: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: boja.meki,
  marginBottom: 4,
}

export default function PorodiceScreen() {
  const [sezonaId, setSezonaId] = useState<string | null>(null)
  const [grupe, setGrupe] = useState<Grupa[]>([])
  const [porodice, setPorodice] = useState<PorodicaSaDecom[]>([])
  const [poruka, setPoruka] = useState<{ tip: 'greska' | 'uspeh'; tekst: string } | null>(null)
  const [cuva, setCuva] = useState(false)
  const [pretraga, setPretraga] = useState('')
  const [uredjujeId, setUredjujeId] = useState<string | null>(null)
  const [obrisaniIds, setObrisaniIds] = useState<string[]>([])

  const [prezime, setPrezime] = useState('')
  const [otacIme, setOtacIme] = useState('')
  const [majkaIme, setMajkaIme] = useState('')
  const [telefon, setTelefon] = useState('')
  const [deca, setDeca] = useState<UnosDeteta[]>([{ ime: '', datum_rodjenja: '', grupa_id: '' }])

  async function ucitajOsnovu() {
    const { data: sez } = await supabase
      .from('sezone')
      .select('id')
      .eq('aktivna', true)
      .maybeSingle()
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
    await ucitajPorodice()
  }

  async function ucitajPorodice() {
    const { data } = await supabase
      .from('porodice')
      .select('id, prezime, otac_ime, majka_ime, telefon, clanovi(id, ime, datum_rodjenja)')
      .order('prezime')
    setPorodice((data as any) ?? [])
  }

  useEffect(() => {
    ucitajOsnovu()
  }, [])

  function resetForma() {
    setPrezime('')
    setOtacIme('')
    setMajkaIme('')
    setTelefon('')
    setDeca([{ ime: '', datum_rodjenja: '', grupa_id: '' }])
    setObrisaniIds([])
    setUredjujeId(null)
  }

  function dodajDete() {
    setDeca([...deca, { ime: '', datum_rodjenja: '', grupa_id: '' }])
  }

  function ukloniDete(i: number) {
    const d = deca[i]
    if (d.id) setObrisaniIds((prev) => [...prev, d.id!])
    const preostala = deca.filter((_, idx) => idx !== i)
    setDeca(preostala.length ? preostala : [{ ime: '', datum_rodjenja: '', grupa_id: '' }])
  }

  function izmeniDete(i: number, polje: keyof UnosDeteta, v: string) {
    setDeca(deca.map((d, idx) => (idx === i ? { ...d, [polje]: v } : d)))
  }

  function labelaGrupe(g: Grupa) {
    return g.uzrast_oznaka ? `${g.naziv} ${g.uzrast_oznaka}` : g.naziv
  }

  async function pocniIzmenu(pid: string) {
    setPoruka(null)
    const { data: por } = await supabase
      .from('porodice')
      .select('id, prezime, otac_ime, majka_ime, telefon, clanovi(id, ime, datum_rodjenja)')
      .eq('id', pid)
      .single()
    if (!por) return
    const clanovi = (por as any).clanovi as { id: string; ime: string; datum_rodjenja: string | null }[]
    const childIds = clanovi.map((c) => c.id)

    const grupaMap: Record<string, { clanstvo_id: string; grupa_id: string }> = {}
    if (childIds.length && sezonaId) {
      const { data: cl } = await supabase
        .from('clanstvo')
        .select('id, clan_id, grupa_id')
        .eq('sezona_id', sezonaId)
        .eq('maticno', true)
        .is('datum_do', null)
        .in('clan_id', childIds)
      for (const c of (cl as any[]) ?? []) {
        grupaMap[c.clan_id] = { clanstvo_id: c.id, grupa_id: c.grupa_id }
      }
    }

    setPrezime((por as any).prezime)
    setOtacIme((por as any).otac_ime ?? '')
    setMajkaIme((por as any).majka_ime ?? '')
    setTelefon((por as any).telefon ?? '')
    setDeca(
      clanovi.length
        ? clanovi.map((c) => ({
            id: c.id,
            ime: c.ime,
            datum_rodjenja: c.datum_rodjenja ?? '',
            grupa_id: grupaMap[c.id]?.grupa_id ?? '',
            clanstvo_id: grupaMap[c.id]?.clanstvo_id,
          }))
        : [{ ime: '', datum_rodjenja: '', grupa_id: '' }]
    )
    setObrisaniIds([])
    setUredjujeId(pid)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function obrisiPorodicu(p: PorodicaSaDecom) {
    if (!window.confirm(`Obrisati porodicu "${nazivPorodice(p)}"? Ova radnja se ne može poništiti.`)) return
    const { error } = await supabase.from('porodice').delete().eq('id', p.id)
    if (error) {
      setPoruka({ tip: 'greska', tekst: 'Greška pri brisanju: ' + error.message })
      return
    }
    if (uredjujeId === p.id) resetForma()
    setPoruka({ tip: 'uspeh', tekst: 'Porodica je obrisana.' })
    await ucitajPorodice()
  }

  async function sacuvaj() {
    setPoruka(null)
    if (!prezime.trim()) {
      setPoruka({ tip: 'greska', tekst: 'Unesi prezime porodice.' })
      return
    }
    const validnaDeca = deca.filter((d) => d.ime.trim())
    if (validnaDeca.length === 0) {
      setPoruka({ tip: 'greska', tekst: 'Dodaj bar jedno dete (ime je obavezno).' })
      return
    }
    if (!sezonaId) {
      setPoruka({ tip: 'greska', tekst: 'Nema aktivne sezone u bazi.' })
      return
    }

    setCuva(true)
    try {
      if (uredjujeId) {
        // --- IZMENA ---
        const { error: eU } = await supabase
          .from('porodice')
          .update({
            prezime: prezime.trim(),
            otac_ime: otacIme.trim() || null,
            majka_ime: majkaIme.trim() || null,
            telefon: telefon.trim() || null,
          })
          .eq('id', uredjujeId)
        if (eU) throw eU

        if (obrisaniIds.length) {
          const { error: eD } = await supabase.from('clanovi').delete().in('id', obrisaniIds)
          if (eD) throw eD
        }

        for (const d of validnaDeca) {
          if (d.id) {
            const { error: e1 } = await supabase
              .from('clanovi')
              .update({ ime: d.ime.trim(), datum_rodjenja: d.datum_rodjenja || null })
              .eq('id', d.id)
            if (e1) throw e1
            if (d.grupa_id) {
              if (d.clanstvo_id) {
                const { error: e2 } = await supabase
                  .from('clanstvo')
                  .update({ grupa_id: d.grupa_id })
                  .eq('id', d.clanstvo_id)
                if (e2) throw e2
              } else {
                const { error: e2 } = await supabase.from('clanstvo').insert({
                  clan_id: d.id,
                  grupa_id: d.grupa_id,
                  sezona_id: sezonaId,
                  maticno: true,
                })
                if (e2) throw e2
              }
            }
          } else {
            const { data: clan, error: e3 } = await supabase
              .from('clanovi')
              .insert({
                porodica_id: uredjujeId,
                ime: d.ime.trim(),
                datum_rodjenja: d.datum_rodjenja || null,
              })
              .select('id')
              .single()
            if (e3) throw e3
            if (d.grupa_id) {
              const { error: e4 } = await supabase.from('clanstvo').insert({
                clan_id: (clan as any).id,
                grupa_id: d.grupa_id,
                sezona_id: sezonaId,
                maticno: true,
              })
              if (e4) throw e4
            }
          }
        }
        setPoruka({ tip: 'uspeh', tekst: 'Izmene su sačuvane.' })
      } else {
        // --- NOVA PORODICA ---
        const { data: por, error: e1 } = await supabase
          .from('porodice')
          .insert({
            prezime: prezime.trim(),
            otac_ime: otacIme.trim() || null,
            majka_ime: majkaIme.trim() || null,
            telefon: telefon.trim() || null,
          })
          .select('id')
          .single()
        if (e1) throw e1

        for (const d of validnaDeca) {
          const { data: clan, error: e2 } = await supabase
            .from('clanovi')
            .insert({
              porodica_id: (por as any).id,
              ime: d.ime.trim(),
              datum_rodjenja: d.datum_rodjenja || null,
            })
            .select('id')
            .single()
          if (e2) throw e2
          if (d.grupa_id) {
            const { error: e3 } = await supabase.from('clanstvo').insert({
              clan_id: (clan as any).id,
              grupa_id: d.grupa_id,
              sezona_id: sezonaId,
              maticno: true,
            })
            if (e3) throw e3
          }
        }
        setPoruka({ tip: 'uspeh', tekst: 'Porodica je sačuvana.' })
      }

      resetForma()
      await ucitajPorodice()
    } catch (err: any) {
      setPoruka({ tip: 'greska', tekst: 'Greška: ' + (err.message ?? String(err)) })
    } finally {
      setCuva(false)
    }
  }

  const filtrirane = porodice.filter((p) => {
    const q = pretraga.trim().toLowerCase()
    if (!q) return true
    return (
      p.prezime.toLowerCase().includes(q) ||
      p.clanovi.some((c) => c.ime.toLowerCase().includes(q))
    )
  })

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
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        background: boja.pozadina,
        color: boja.tekst,
        minHeight: '100vh',
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 2px' }}>Porodice i deca</h1>
        <p style={{ color: boja.meki, marginTop: 0, fontSize: 14 }}>
          {uredjujeId ? 'Izmena postojeće porodice' : 'Unos nove porodice sa decom'} · sezona 2026/2027
        </p>

        <div
          style={{
            background: boja.karta,
            border: `1px solid ${uredjujeId ? boja.akcenat : boja.ivica}`,
            borderRadius: 12,
            padding: 16,
            marginTop: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {uredjujeId ? 'Izmena porodice' : 'Nova porodica'}
            </div>
            {uredjujeId && (
              <button onClick={resetForma} style={dugmeMalo}>
                Otkaži izmenu
              </button>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={stilLabela}>Prezime *</label>
            <input
              style={stilInput}
              value={prezime}
              onChange={(e) => setPrezime(e.target.value)}
              placeholder="npr. Vidović"
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={stilLabela}>Ime oca (opciono)</label>
              <input style={stilInput} value={otacIme} onChange={(e) => setOtacIme(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={stilLabela}>Ime majke (opciono)</label>
              <input style={stilInput} value={majkaIme} onChange={(e) => setMajkaIme(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={stilLabela}>Telefon (opciono)</label>
            <input style={stilInput} value={telefon} onChange={(e) => setTelefon(e.target.value)} />
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Deca</div>

          {deca.map((d, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${boja.ivica}`,
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                background: boja.pozadina,
              }}
            >
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: 140 }}>
                  <label style={stilLabela}>Ime deteta *</label>
                  <input
                    style={stilInput}
                    value={d.ime}
                    onChange={(e) => izmeniDete(i, 'ime', e.target.value)}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={stilLabela}>Datum rođenja</label>
                  <input
                    type="date"
                    style={stilInput}
                    value={d.datum_rodjenja}
                    onChange={(e) => izmeniDete(i, 'datum_rodjenja', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={stilLabela}>Matična grupa</label>
                <select
                  style={stilInput}
                  value={d.grupa_id}
                  onChange={(e) => izmeniDete(i, 'grupa_id', e.target.value)}
                >
                  <option value="">— izaberi grupu —</option>
                  {grupe.map((g) => (
                    <option key={g.id} value={g.id}>
                      {labelaGrupe(g)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => ukloniDete(i)}
                style={{
                  marginTop: 10,
                  background: 'none',
                  border: 'none',
                  color: boja.greska,
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: 0,
                }}
              >
                Ukloni dete
              </button>
            </div>
          ))}

          <button
            onClick={dodajDete}
            style={{
              background: 'none',
              border: `1px dashed ${boja.ivica}`,
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 14,
              color: boja.tekst,
              width: '100%',
            }}
          >
            + Dodaj još jedno dete
          </button>

          {poruka && (
            <p
              style={{
                marginTop: 14,
                marginBottom: 0,
                fontSize: 14,
                color: poruka.tip === 'greska' ? boja.greska : boja.uspeh,
              }}
            >
              {poruka.tekst}
            </p>
          )}

          <button
            onClick={sacuvaj}
            disabled={cuva}
            style={{
              marginTop: 14,
              background: boja.akcenat,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 15,
              fontWeight: 600,
              cursor: cuva ? 'default' : 'pointer',
              width: '100%',
              opacity: cuva ? 0.6 : 1,
            }}
          >
            {cuva ? 'Čuvam...' : uredjujeId ? 'Sačuvaj izmene' : 'Sačuvaj porodicu'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 8px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Upisane porodice ({filtrirane.length})
          </h2>
        </div>

        <input
          style={{ ...stilInput, marginBottom: 10 }}
          value={pretraga}
          onChange={(e) => setPretraga(e.target.value)}
          placeholder="Pretraga po prezimenu ili imenu deteta..."
        />

        {filtrirane.length === 0 ? (
          <p style={{ color: boja.meki, fontSize: 14 }}>
            {porodice.length === 0 ? 'Još nema upisanih porodica.' : 'Nema rezultata za pretragu.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtrirane.map((p) => (
              <div
                key={p.id}
                style={{
                  background: boja.karta,
                  border: `1px solid ${boja.ivica}`,
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{nazivPorodice(p)}</div>
                  <div style={{ color: boja.meki, fontSize: 13, marginTop: 2 }}>
                    {p.clanovi.length} {p.clanovi.length === 1 ? 'dete' : 'dece'}
                    {p.otac_ime || p.majka_ime
                      ? ' · ' + [p.otac_ime, p.majka_ime].filter(Boolean).join(', ')
                      : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => pocniIzmenu(p.id)} style={dugmeMalo}>
                    Izmeni
                  </button>
                  <button
                    onClick={() => obrisiPorodicu(p)}
                    style={{ ...dugmeMalo, color: boja.greska, borderColor: boja.ivica }}
                  >
                    Obriši
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
