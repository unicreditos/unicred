import tls from 'node:tls'

const g = globalThis as typeof globalThis & { __AFIP_TLS_PATCHED__?: boolean }

if (!g.__AFIP_TLS_PATCHED__) {
  g.__AFIP_TLS_PATCHED__ = true
  const original = tls.createSecureContext
  tls.createSecureContext = function patchAfipTls(options) {
    return original({
      ...options,
      ciphers: 'DEFAULT@SECLEVEL=0',
      minVersion: 'TLSv1',
    })
  }
}
