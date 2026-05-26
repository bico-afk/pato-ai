const KEY = 'bikco_anon_token'

export function getAnonToken(): string {
  if (typeof window === 'undefined') return ''
  let token = localStorage.getItem(KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(KEY, token)
  }
  return token
}

export function clearAnonToken(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY)
}

/** Display name for anonymous users derived from their token */
export function anonUsername(token: string): string {
  return `@anon_${token.slice(0, 8)}`
}
