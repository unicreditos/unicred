'use client'

import { getGeoDepartments, getGeoLocalities, getGeoProvinces } from '@/app/actions/register'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEffect, useMemo, useState } from 'react'

const CPA_LETTER: Record<string, string> = {
  caba: 'C',
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

function cpaLetterForProvince(province: string) {
  const key = province
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
  return CPA_LETTER[key] ?? ''
}

export type GeoValue = {
  province: string
  department: string
  city: string
  postalCode: string
}

type Opt = { id: string; name: string }

export function GeoArFields({
  value,
  onChange,
}: {
  value: GeoValue
  onChange: (next: GeoValue) => void
}) {
  const [provinces, setProvinces] = useState<Opt[]>([])
  const [deptCache, setDeptCache] = useState<Record<string, Opt[]>>({})
  const [locCache, setLocCache] = useState<Record<string, Opt[]>>({})
  const [cityFilter, setCityFilter] = useState('')

  useEffect(() => {
    let alive = true
    void getGeoProvinces().then((res) => {
      if (!alive) return
      setProvinces(res.items)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const province = value.province
    if (!province || deptCache[province]) return
    let alive = true
    void getGeoDepartments(province).then((res) => {
      if (!alive) return
      setDeptCache((prev) => (prev[province] ? prev : { ...prev, [province]: res.items }))
    })
    return () => {
      alive = false
    }
  }, [value.province, deptCache])

  const locKey = value.province && value.department ? `${value.province}|${value.department}` : ''

  useEffect(() => {
    if (!locKey || locCache[locKey]) return
    let alive = true
    void getGeoLocalities(value.province, value.department).then((res) => {
      if (!alive) return
      setLocCache((prev) => (prev[locKey] ? prev : { ...prev, [locKey]: res.items }))
    })
    return () => {
      alive = false
    }
  }, [locKey, locCache, value.department, value.province])

  const departments = value.province ? (deptCache[value.province] ?? []) : []
  const localities = useMemo(
    () => (locKey ? (locCache[locKey] ?? []) : []),
    [locCache, locKey],
  )
  const loadingDpto = Boolean(value.province) && !(value.province in deptCache)
  const loadingLoc = Boolean(locKey) && !(locKey in locCache)

  const filteredLocalities = useMemo(() => {
    const q = cityFilter.trim().toLowerCase()
    if (!q) return localities.slice(0, 80)
    return localities.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 80)
  }, [localities, cityFilter])

  const letter = cpaLetterForProvince(value.province)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Provincia *</Label>
        <Select
          value={value.province || undefined}
          onValueChange={(province) =>
            onChange({ province: province ?? '', department: '', city: '', postalCode: value.postalCode })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={provinces.length === 0 ? 'Cargando…' : 'Seleccioná provincia'} />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((p) => (
              <SelectItem key={p.id} value={p.name}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Departamento / partido *</Label>
        <Select
          value={value.department || undefined}
          onValueChange={(department) =>
            onChange({ ...value, department: department ?? '', city: '' })
          }
          disabled={!value.province || loadingDpto}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={loadingDpto ? 'Cargando…' : 'Seleccioná departamento'} />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.name}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Localidad / ciudad *</Label>
        {localities.length > 20 && (
          <Input
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="Filtrar localidad"
          />
        )}
        <Select
          value={value.city || undefined}
          onValueChange={(city) => onChange({ ...value, city: city ?? '' })}
          disabled={!value.department || loadingLoc}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={loadingLoc ? 'Cargando…' : 'Seleccioná localidad'} />
          </SelectTrigger>
          <SelectContent>
            {filteredLocalities.map((l) => (
              <SelectItem key={l.id} value={l.name}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="postalCode">Código postal *</Label>
        <Input
          id="postalCode"
          value={value.postalCode}
          onChange={(e) => onChange({ ...value, postalCode: e.target.value.toUpperCase() })}
          placeholder={letter ? `${letter}1000` : '5000'}
        />
        {letter ? (
          <p className="text-xs text-muted-foreground">
            En {value.province} el CPA suele empezar con la letra {letter}.
          </p>
        ) : null}
      </div>
    </div>
  )
}
