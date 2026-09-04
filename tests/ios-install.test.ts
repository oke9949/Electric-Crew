import assert from 'node:assert/strict'
import test from 'node:test'
import { isIosSafari, shouldShowIosInstallGuide } from '../src/ios-install.ts'

const iphoneSafari={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',maxTouchPoints:5,standalone:false}

test('shows install guidance only in non-standalone iOS Safari',()=>{
  assert.equal(isIosSafari(iphoneSafari),true)
  assert.equal(shouldShowIosInstallGuide(iphoneSafari),true)
  assert.equal(shouldShowIosInstallGuide({...iphoneSafari,standalone:true}),false)
  assert.equal(shouldShowIosInstallGuide({...iphoneSafari,userAgent:iphoneSafari.userAgent+' CriOS/128'}),false)
})

test('detects iPadOS desktop user agent through touch capability',()=>{
  assert.equal(isIosSafari({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',maxTouchPoints:5,standalone:false}),true)
})
