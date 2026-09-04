import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
const upload = await readFile(new URL('../src/BatchDocumentUpload.tsx', import.meta.url), 'utf8')

test('the mobile navigation exposes the five daily entry points', () => {
  for (const label of ['Kezdőlap', 'Munkák', 'Új', 'Térkép', 'AI']) {
    assert.match(app, new RegExp(`label:'${label}'`))
  }
  assert.match(app, /aria-label="Elsődleges mobil navigáció"/)
  assert.match(css, /\.bottom-nav \.quick-main/)
})

test('rare functions remain under a labelled more section', () => {
  assert.match(app, /nav-group-label">Továbbiak/)
  assert.match(app, /const moreNav=visibleNav\.filter/)
})

test('projects provide one workspace for daily modules', () => {
  for (const label of ['Rendszerek', 'Feladatok', 'Munkanapló', 'Dokumentumok', 'Projektchat']) {
    assert.match(app, new RegExp(label))
  }
  assert.match(app, /function ProjectWorkspace/)
  assert.match(app, /onOpen=\{\(\)=>onOpen\(r\.id\)\}/)
})

test('the main DWG mobile upload fix stays untouched', () => {
  assert.doesNotMatch(upload, /accept=/)
  assert.match(upload, /\.dwg/)
  assert.match(upload, /\.dxf/)
})
