import type { CSSProperties } from 'react'

export const T = {
  boja: {
    brand: '#ff4d00', brandHover: '#ff6e1a', brandOnDark: '#ff8e42',
    pill: '#ffeedb', pillEdge: '#ffe5cc', pillText: '#d43302',
    ink: '#111827', ink800: '#242d3d', ink700: '#374151', ink600: '#4b5563',
    ink500: '#6b7280', ink400: '#9ca3af', edge: '#e5e7eb', fill: '#f3f4f6',
    bg: '#f9fafb', white: '#ffffff',
    green: '#0dac37', green700: '#0d882e', greenBg: '#e7fdec', greenEdge: '#b7fbc8',
    yellow: '#df7700', yellowBg: '#fff8db',
    red: '#ca2121', red700: '#a41919', redBg: '#fde7e7', redEdge: '#feb9b9',
    purple: '#7755ff',
  },
  r: { pill: 99, control: 10, card: 14, panel: 16, modal: 18, sheet: 22, brand: 26 },
}

export function pragBoja(p: number): string {
  if (p >= 75) return T.boja.green
  if (p >= 50) return T.boja.yellow
  return T.boja.red
}

type Var = 'brand' | 'default-purple' | 'default-black' | 'outline-black' | 'ghost-black' | 'outline-danger'
type Vel = 'lg' | 'md' | 'sm' | 'xs'

export function dugme(variant: Var = 'default-black', size: Vel = 'md'): CSSProperties {
  const vis = { lg: { h: 48, px: 20, fs: 15 }, md: { h: 40, px: 16, fs: 14 }, sm: { h: 36, px: 14, fs: 13 }, xs: { h: 30, px: 11, fs: 12 } }[size]
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: vis.h, padding: `0 ${vis.px}px`, borderRadius: 10, fontSize: vis.fs, fontWeight: 700,
    cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit', whiteSpace: 'nowrap',
  }
  const v: Record<Var, CSSProperties> = {
    'brand': { background: T.boja.brand, color: '#fff' },
    'default-purple': { background: T.boja.purple, color: '#fff' },
    'default-black': { background: T.boja.ink, color: '#fff' },
    'outline-black': { background: '#fff', color: T.boja.ink, borderColor: T.boja.edge },
    'ghost-black': { background: 'transparent', color: T.boja.ink },
    'outline-danger': { background: '#fff', color: T.boja.red, borderColor: T.boja.redEdge },
  }
  return { ...base, ...v[variant] }
}

export const polje: CSSProperties = {
  width: '100%', height: 44, padding: '0 14px', border: `1px solid ${T.boja.edge}`,
  borderRadius: 10, fontSize: 14, fontWeight: 600, background: '#fff', color: T.boja.ink,
  boxSizing: 'border-box', fontFamily: 'inherit',
}
export const labela: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: T.boja.ink500, marginBottom: 7 }
export const kartica: CSSProperties = { background: '#fff', border: `1px solid ${T.boja.edge}`, borderRadius: 14, padding: 16 }
export function pilula(bg: string, fg: string): CSSProperties {
  return { fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 99, background: bg, color: fg, display: 'inline-block' }
}
