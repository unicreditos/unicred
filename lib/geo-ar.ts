const GEOREF = 'https://apis.datos.gob.ar/georef/api'
const TTL_MS = 6 * 60 * 60 * 1000

export type GeoOption = { id: string; name: string }

type CacheEntry<T> = { value: T; expiresAt: number }
const cache = new Map<string, CacheEntry<unknown>>()

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function readCache<T>(key: string): T | null {
  const hit = cache.get(key)
  if (!hit || hit.expiresAt <= Date.now()) return null
  return hit.value as T
}

function writeCache<T>(key: string, value: T) {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS })
}

async function georef<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const url = new URL(`${GEOREF}${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'UNICREDITOS/1.0' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Georef ${res.status}`)
  return (await res.json()) as T
}

const ALIASES: Record<string, string> = {
  caba: 'ciudad autonoma de buenos aires',
  'capital federal': 'ciudad autonoma de buenos aires',
  'ciudad de buenos aires': 'ciudad autonoma de buenos aires',
}

export const CPA_LETTER: Record<string, string> = {
  'ciudad autonoma de buenos aires': 'C',
  'buenos aires': 'B',
  catamarca: 'K',
  chaco: 'H',
  chubut: 'U',
  cordoba: 'X',
  corrientes: 'W',
  'entre rios': 'E',
  formosa: 'P',
  jujuy: 'Y',
  'la pampa': 'L',
  'la rioja': 'F',
  mendoza: 'M',
  misiones: 'N',
  neuquen: 'Q',
  'rio negro': 'R',
  salta: 'A',
  'san juan': 'J',
  'san luis': 'D',
  'santa cruz': 'Z',
  'santa fe': 'S',
  'santiago del estero': 'G',
  'tierra del fuego': 'V',
  tucuman: 'T',
}

export function cpaLetterForProvince(province: string) {
  const key = fold(ALIASES[fold(province)] ? ALIASES[fold(province)] : province)
  return CPA_LETTER[key] ?? ''
}

export function displayProvinceName(name: string) {
  return fold(name) === 'ciudad autonoma de buenos aires' ? 'CABA' : name
}

export async function listProvinces(): Promise<GeoOption[]> {
  const cached = readCache<GeoOption[]>('provincias')
  if (cached) return cached
  const json = await georef<{ provincias: { id: string; nombre: string }[] }>('/provincias', {
    campos: 'id,nombre',
    max: 30,
  })
  const rows = (json.provincias ?? [])
    .map((p) => ({ id: p.id, name: displayProvinceName(p.nombre) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  writeCache('provincias', rows)
  return rows
}

function officialProvinceName(name: string) {
  const folded = fold(name)
  if (folded === 'caba' || folded === 'capital federal') return 'Ciudad Autónoma de Buenos Aires'
  return name
}

export async function listDepartments(provinceName: string): Promise<GeoOption[]> {
  const key = `dptos:${fold(provinceName)}`
  const cached = readCache<GeoOption[]>(key)
  if (cached) return cached
  const json = await georef<{ departamentos: { id: string; nombre: string }[] }>('/departamentos', {
    provincia: officialProvinceName(provinceName),
    campos: 'id,nombre',
    max: 500,
    orden: 'nombre',
  })
  const rows = (json.departamentos ?? []).map((d) => ({ id: d.id, name: d.nombre }))
  writeCache(key, rows)
  return rows
}

export async function listLocalities(provinceName: string, departmentName: string): Promise<GeoOption[]> {
  const key = `loc:${fold(provinceName)}:${fold(departmentName)}`
  const cached = readCache<GeoOption[]>(key)
  if (cached) return cached
  const json = await georef<{ localidades: { id: string; nombre: string }[] }>('/localidades', {
    provincia: officialProvinceName(provinceName),
    departamento: departmentName,
    campos: 'id,nombre',
    max: 1000,
    orden: 'nombre',
  })
  const rows = (json.localidades ?? []).map((l) => ({ id: l.id, name: l.nombre }))
  writeCache(key, rows)
  return rows
}

export function streetForGeoref(address: string) {
  return address
    .replace(/\bPiso[:\s].*$/i, '')
    .replace(/\bDpto\.?[:\s].*$/i, '')
    .replace(/\bDepto\.?[:\s].*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function geoFromDireccionHit(hit: {
  departamento?: { nombre?: string | null } | null
  localidad_censal?: { nombre?: string | null } | null
  provincia?: { nombre?: string | null } | null
} | null | undefined) {
  const provinceRaw = String(hit?.provincia?.nombre ?? '').trim()
  const department = String(hit?.departamento?.nombre ?? '').trim()
  const censusCity = String(hit?.localidad_censal?.nombre ?? '').trim()
  const province = provinceRaw ? displayProvinceName(officialProvinceName(provinceRaw)) : ''
  const city =
    censusCity && fold(censusCity) !== fold(officialProvinceName(province || censusCity))
      ? censusCity
      : ''
  return { province, department, city }
}

export async function resolveGeoFromPadron(input: {
  province?: string
  city?: string
  postalCode?: string
  address?: string
}): Promise<{ province: string; department: string; city: string; postalCode: string }> {
  const provinceRaw = String(input.province ?? '').trim()
  const cityRaw = String(input.city ?? '').trim()
  const postalCode = String(input.postalCode ?? '').trim()
  const address = streetForGeoref(String(input.address ?? '').trim())
  let province = provinceRaw ? displayProvinceName(officialProvinceName(provinceRaw)) : ''
  let department = ''
  let city = cityRaw

  if (address && (province || cityRaw)) {
    const cacheKey = `dir:${fold(province)}:${fold(address)}`
    const cached = readCache<{ province: string; department: string; city: string }>(cacheKey)
    if (cached) {
      return {
        province: cached.province || province,
        department: cached.department,
        city: city || cached.city,
        postalCode,
      }
    }
    try {
      const json = await georef<{
        direcciones: Array<{
          departamento?: { nombre?: string }
          localidad_censal?: { nombre?: string }
          provincia?: { nombre?: string }
        }>
      }>('/direcciones', {
        direccion: address,
        ...(province ? { provincia: officialProvinceName(province) } : {}),
        max: 1,
      })
      const fromDir = geoFromDireccionHit(json.direcciones?.[0])
      province = fromDir.province || province
      department = fromDir.department
      city = city || fromDir.city
      writeCache(cacheKey, { province, department, city })
    } catch {
      /* Georef direcciones es best-effort */
    }
  }

  if (!province) {
    return { province: '', department, city, postalCode }
  }
  if (department) {
    if (city) {
      try {
        const locJson = await georef<{
          localidades: Array<{ nombre?: string }>
        }>('/localidades', {
          provincia: officialProvinceName(province),
          departamento: department,
          campos: 'id,nombre',
          max: 80,
        })
        const match = (locJson.localidades ?? [])
          .map((l) => String(l.nombre ?? '').trim())
          .find((n) => n && fold(n) === fold(city))
        if (match) city = match
      } catch {
        /* el catálogo de localidades es best-effort */
      }
    }
    return { province, department, city, postalCode }
  }
  if (!city) {
    return { province, department, city: '', postalCode }
  }
  const cacheKey = `padron:${fold(province)}:${fold(city)}`
  const cached = readCache<{ province: string; department: string; city: string }>(cacheKey)
  if (cached) return { ...cached, postalCode }
  try {
    const json = await georef<{
      localidades: Array<{ nombre?: string; departamento?: { nombre?: string } }>
    }>('/localidades', {
      provincia: officialProvinceName(province),
      nombre: city,
      campos: 'id,nombre,departamento',
      max: 8,
    })
    const hit = json.localidades?.[0]
    const resolved = {
      province,
      department: department || String(hit?.departamento?.nombre ?? '').trim(),
      city: String(hit?.nombre ?? city).trim(),
    }
    writeCache(cacheKey, resolved)
    return { ...resolved, postalCode }
  } catch {
    return { province, department, city, postalCode }
  }
}
