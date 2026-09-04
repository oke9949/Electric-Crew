import assert from 'node:assert/strict'
import test from 'node:test'
import { compareVersions, configureAndroidGradle, parseAndroidVersion } from './android-release.mjs'

test('derives deterministic Android version codes', () => {
  assert.deepEqual(parseAndroidVersion('10.0.3'), { versionName: '10.0.3', versionCode: 100003 })
  assert.equal(compareVersions('10.0.3', '10.0.2') > 0, true)
  assert.throws(() => parseAndroidVersion('10.0.100'))
})

test('configures generated Gradle versions and release signing once', () => {
  const source = 'android {\n  defaultConfig {\n    versionCode 1\n    versionName "1.0"\n  }\n}\n'
  const configured = configureAndroidGradle(source, '10.0.3', 100003)
  assert.match(configured, /versionCode 100003/)
  assert.match(configured, /versionName "10\.0\.3"/)
  assert.match(configured, /ANDROID_KEYSTORE_PATH/)
  assert.equal(configureAndroidGradle(configured, '10.0.3', 100003), configured)
})
