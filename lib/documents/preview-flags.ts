/** Flags de vista previa resueltos en el servidor (evita mismatch de hidratación con useSearchParams). */
export function documentPreviewFlags(
  sp: { embed?: string | string[]; print?: string | string[] } | null | undefined,
) {
  const embedRaw = sp?.embed
  const printRaw = sp?.print
  const embed =
    embedRaw === '1' || (Array.isArray(embedRaw) && embedRaw.includes('1'))
  const autoPrint =
    printRaw === '1' || (Array.isArray(printRaw) && printRaw.includes('1'))
  return { embed, autoPrint }
}
