import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { brandedEmailHtml, emailLogoUrl, emailOrigin, passwordResetEmail } from '../../lib/email'

describe('correo institucional', () => {
  it('usa www y PNG (no SVG) para el logo', () => {
    assert.equal(emailOrigin(), 'https://www.unicreditos.com')
    assert.equal(emailLogoUrl(), 'https://www.unicreditos.com/apple-icon')
  })

  it('el HTML lleva membrete, logo y pie legal', () => {
    const html = brandedEmailHtml({
      title: 'Pago acreditado',
      bodyHtml: '<p>Hola</p>',
      cta: { href: 'https://www.unicreditos.com/dashboard', label: 'Ver comprobante' },
    })
    assert.match(html, /apple-icon/)
    assert.match(html, /UNICRÉDITOS/)
    assert.match(html, /RM International Group/)
    assert.match(html, /Ver comprobante/)
    assert.doesNotMatch(html, /logo\.svg/)
  })

  it('el recupero de clave no incluye copia operativa en el HTML', () => {
    const mail = passwordResetEmail('https://www.unicreditos.com/reset')
    assert.match(mail.subject, /contraseña/i)
    assert.match(mail.html, /apple-icon/)
  })
})
