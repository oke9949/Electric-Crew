export type GithubRelease = {
  tag_name?: string
  html_url?: string
  name?: string
  assets?: Array<{ name?: string; browser_download_url?: string }>
}

export type UpdateInfo = {
  version: string
  downloadUrl: string
}

export function normalizeVersion(value: string) {
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/)
  return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : ''
}

export function isNewerVersion(candidate: string, current: string) {
  const a = normalizeVersion(candidate).split('.').map(Number)
  const b = normalizeVersion(current).split('.').map(Number)
  if (a.length !== 3 || b.length !== 3 || a.some(Number.isNaN) || b.some(Number.isNaN)) return false

  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true
    if (a[i] < b[i]) return false
  }
  return false
}

export function resolveReleaseUpdate(release: GithubRelease, currentVersion: string): UpdateInfo | null {
  const version = normalizeVersion(release.tag_name || release.name || '')
  if (!version || !isNewerVersion(version, currentVersion)) return null

  const expectedName = `Electric-Crew-${version}.apk`.toLowerCase()
  const apk = (release.assets || []).find(asset => String(asset.name || '').toLowerCase() === expectedName)
  if (!apk?.browser_download_url) return null

  return { version, downloadUrl: apk.browser_download_url }
}
