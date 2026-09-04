import assert from 'node:assert/strict'
import test from 'node:test'
import { isNewerVersion, normalizeVersion, resolveReleaseUpdate } from '../src/app-update-utils.ts'

test('compares semantic Android release versions', () => {
  assert.equal(normalizeVersion('android-v10.0.3'), '10.0.3')
  assert.equal(isNewerVersion('10.0.3', '10.0.2'), true)
  assert.equal(isNewerVersion('10.0.2', '10.0.2'), false)
  assert.equal(isNewerVersion('9.99.99', '10.0.2'), false)
})

test('resolves only the canonical APK asset for the newer release', () => {
  const url = 'https://github.com/oke9949/Electric-Crew/releases/download/android-v10.0.3/Electric-Crew-10.0.3.apk'
  assert.deepEqual(resolveReleaseUpdate({
    tag_name: 'android-v10.0.3',
    assets: [{ name: 'Electric-Crew-10.0.3.apk', browser_download_url: url }],
  }, '10.0.2'), { version: '10.0.3', downloadUrl: url })

  assert.equal(resolveReleaseUpdate({
    tag_name: 'android-v10.0.3',
    assets: [{ name: 'unrelated.apk', browser_download_url: url }],
  }, '10.0.2'), null)
})
