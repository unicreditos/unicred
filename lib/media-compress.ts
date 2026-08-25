export async function fileToDataUrl(file: File, maxBytes = 700_000): Promise<string> {
  if (file.type.startsWith('video/')) {
    if (file.size > 1_800_000) {
      throw new Error('El video debe pesar menos de 1,8 MB. Grabá un clip corto.')
    }
    return readFile(file)
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Solo se aceptan imágenes o un video corto.')
  }
  const bitmap = await createImageBitmap(file)
  const maxSide = 1280
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  let quality = 0.82
  let data = canvas.toDataURL('image/jpeg', quality)
  while (data.length > maxBytes && quality > 0.4) {
    quality -= 0.1
    data = canvas.toDataURL('image/jpeg', quality)
  }
  if (data.length > maxBytes) {
    throw new Error('La imagen sigue siendo muy pesada. Probá otra foto.')
  }
  return data
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}
