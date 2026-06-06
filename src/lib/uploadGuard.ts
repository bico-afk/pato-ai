/* Validação de upload de mídia (cliente). Defesa contra arquivos enormes/tipos
   inválidos antes de subir ao storage. Complementa as regras do bucket. */

const MAX_IMAGE_MB = 12
const MAX_VIDEO_MB = 60
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

/** Retorna uma mensagem de erro (string) se inválido, ou null se ok. */
export function validateMediaFile(file: File): string | null {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  if (!isImage && !isVideo) return 'Envie apenas imagens ou vídeos.'

  const okType = isImage ? IMAGE_TYPES.includes(file.type) : VIDEO_TYPES.includes(file.type)
  if (!okType) return 'Formato não suportado. Use JPG, PNG, WEBP, MP4 ou MOV.'

  const maxMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB
  if (file.size > maxMB * 1024 * 1024) return `Arquivo muito grande (máx. ${maxMB}MB).`

  return null
}
