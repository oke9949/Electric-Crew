import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function parseAndroidVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim())
  if (!match) throw new Error(`Invalid Android version: ${value}`)

  const [, majorText, minorText, patchText] = match
  const major = Number(majorText)
  const minor = Number(minorText)
  const patch = Number(patchText)
  if (major < 1 || minor > 99 || patch > 99) {
    throw new Error('Android versions must use MAJOR.MINOR.PATCH with MINOR and PATCH between 0 and 99')
  }

  const versionCode = major * 10_000 + minor * 100 + patch
  if (!Number.isSafeInteger(versionCode) || versionCode > 2_100_000_000) {
    throw new Error(`Android versionCode is outside the supported range: ${versionCode}`)
  }

  return { versionName: `${major}.${minor}.${patch}`, versionCode }
}

export function compareVersions(left, right) {
  return parseAndroidVersion(left).versionCode - parseAndroidVersion(right).versionCode
}

export function configureAndroidGradle(source, versionName, versionCode) {
  const parsed = parseAndroidVersion(versionName)
  if (parsed.versionCode !== Number(versionCode)) {
    throw new Error(`versionName ${versionName} does not match versionCode ${versionCode}`)
  }

  let configured = source.replace(/versionCode\s+1\b/, `versionCode ${versionCode}`)
  configured = configured.replace(/versionName\s+"1\.0"/, `versionName "${versionName}"`)
  if (!configured.includes(`versionCode ${versionCode}`) || !configured.includes(`versionName "${versionName}"`)) {
    throw new Error('Generated Gradle version fields did not match the expected Capacitor template')
  }

  if (!configured.includes('ELECTRIC_CREW_RELEASE_SIGNING')) {
    configured += `

// ELECTRIC_CREW_RELEASE_SIGNING: injected deterministically by GitHub Actions.
android {
    signingConfigs {
        release {
            def releaseKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (releaseKeystorePath != null && !releaseKeystorePath.isEmpty()) {
                storeFile file(releaseKeystorePath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
`
  }

  return configured
}

function packageVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))
  return parseAndroidVersion(packageJson.version)
}

function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'version') {
    const version = packageVersion()
    process.stdout.write(`app_version=${version.versionName}\nversion_code=${version.versionCode}\n`)
    return
  }

  if (command === 'configure') {
    const [gradlePath, versionName, versionCode] = args
    if (!gradlePath || !versionName || !versionCode) throw new Error('configure requires GRADLE_PATH VERSION_NAME VERSION_CODE')
    const source = fs.readFileSync(gradlePath, 'utf8')
    fs.writeFileSync(gradlePath, configureAndroidGradle(source, versionName, Number(versionCode)))
    return
  }

  if (command === 'validate-history') {
    const [candidate, ...published] = args
    const releases = published.map(tag => tag.replace(/^android-v/, '')).filter(tag => /^\d+\.\d+\.\d+$/.test(tag))
    const newest = releases.sort((a, b) => compareVersions(b, a))[0]
    if (newest && compareVersions(candidate, newest) < 0) {
      throw new Error(`Version ${candidate} is older than published Android release ${newest}`)
    }
    return
  }

  throw new Error(`Unknown command: ${command || '(missing)'}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
}
