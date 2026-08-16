export type CenRed = {
  id: string
  iznos_1_dete: number
  iznos_2_dete: number
  iznos_3plus: number
  vazi_od: string | null
  vazi_do: string | null
}

export function cenovnikZaPeriod(lista: CenRed[], period: string): CenRed | null {
  const kandidati = lista.filter(
    (c) => (!c.vazi_od || c.vazi_od <= period) && (!c.vazi_do || c.vazi_do >= period)
  )
  if (kandidati.length) {
    return [...kandidati].sort((a, b) => (b.vazi_od ?? '').localeCompare(a.vazi_od ?? ''))[0]
  }
  const sortirani = [...lista].sort((a, b) => (a.vazi_od ?? '').localeCompare(b.vazi_od ?? ''))
  return sortirani[0] ?? null
}

export function iznosZa(c: CenRed | null, n: number): number {
  if (!c || n <= 0) return 0
  let s = 0
  if (n >= 1) s += Number(c.iznos_1_dete)
  if (n >= 2) s += Number(c.iznos_2_dete)
  if (n >= 3) s += Number(c.iznos_3plus) * (n - 2)
  return s
}
