import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('manifest exposes a complete standalone app identity',()=>{
  const manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'))
  assert.equal(manifest.id,'/')
  assert.equal(manifest.start_url,'/')
  assert.equal(manifest.scope,'/')
  assert.equal(manifest.display,'standalone')
  assert.deepEqual(manifest.icons.map(icon=>icon.sizes),['192x192','512x512'])
})

test('service worker keeps authenticated traffic out of Cache Storage',()=>{
  const source=fs.readFileSync('public/sw.js','utf8')
  assert.match(source,/url\.origin !== self\.location\.origin/)
  assert.match(source,/url\.pathname\.startsWith\('\/api\/'\)/)
  assert.match(source,/request\.headers\.has\('authorization'\)/)
  assert.doesNotMatch(source,/APP_SHELL[^\n]*(?:api|supabase|auth)/i)
})

test('HTML contains the iOS standalone metadata and touch icon',()=>{
  const html=fs.readFileSync('index.html','utf8')
  assert.match(html,/apple-mobile-web-app-capable/)
  assert.match(html,/apple-mobile-web-app-status-bar-style/)
  assert.match(html,/rel="apple-touch-icon"/)
  assert.match(html,/viewport-fit=cover/)
})

test('camera shortcut coexists with the unrestricted DWG-capable picker',()=>{
  const source=fs.readFileSync('src/BatchDocumentUpload.tsx','utf8')
  assert.match(source,/accept="image\/\*" capture="environment"/)
  assert.match(source,/Fájlok kiválasztása[\s\S]*<input type="file" multiple disabled=\{busy\} onChange=/)
})
