import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
const PUBLIC = ['app/page.tsx', 'app/scoring/page.tsx', 'components/unicred/public-chrome.tsx', 'components/landing/live-statement.tsx', 'components/loan-simulator.tsx', 'app/simulador/page.tsx']

describe('home publica: copy alineado con lo aprobado', () => {
  it('no promete aprobacion/rechazo automaticos (decide una persona)', () => {
    for (const p of ['app/page.tsx', 'app/scoring/page.tsx']) {
      const t = read(p)
      assert.ok(!/decisi[óo]n es autom[áa]tica/i.test(t), p)
      assert.ok(!/evaluaci[óo]n es autom[áa]tica/i.test(t), p)
      assert.ok(!/aprobaci[óo]n autom[áa]tica:/i.test(t), p)
      assert.ok(!/rechazo autom[áa]tico/i.test(t), p)
    }
    assert.match(read('app/page.tsx'), /un analista/i)
  })
  it('dice firma electronica y nunca firma digital', () => {
    for (const p of PUBLIC) assert.ok(!/firma digital/i.test(read(p)), p)
    assert.match(read('app/page.tsx'), /firma electr[óo]nica/)
    assert.match(read('components/unicred/public-chrome.tsx'), /firma de forma electr[óo]nica/)
  })
  it('seccion de seguridad cubre 2FA correo+app, sesiones, identidad y huella SHA-256', () => {
    const t = read('app/page.tsx')
    assert.match(t, /Verificaci[óo]n en dos pasos/)
    assert.match(t, /app autenticadora/)
    assert.match(t, /Sesiones bajo tu control/)
    assert.match(t, /12 meses/)
    assert.match(t, /SHA-256/)
  })
  it('NO publica comisiones por tramo ni el CFT recalculado, y mantiene CFT = TEA x 1,21', () => {
    for (const p of PUBLIC) {
      const t = read(p)
      assert.ok(!/comisi[óo]n(es)? (por|de) (tramo|otorgamiento)/i.test(t), p)
      assert.ok(!/177|238/.test(t.replace(/[0-9]{4,}/g, '')), `${p}: aparece 177/238`)
    }
    assert.match(read('components/loan-simulator.tsx'), /CFT = TEA [x×] 1,21/)
    assert.match(read('components/landing/live-statement.tsx'), /CFT = TEA [x×] 1,21/)
  })
  it('no hay marcas ni datos de terceros en las paginas publicas de la home y el simulador', () => {
    const rx = /naranja\s*x|ual[áa]\b|credicuotas|rappi|mercado\s*cr[ée]dito|brubank|personal\s*pay/i
    for (const p of PUBLIC) {
      const t = read(p).replace(/Mercado Pago/g, '')
      assert.ok(!rx.test(t), `${p} menciona un tercero`)
    }
  })
})