const IOS_DEVICE = /iPad|iPhone|iPod/
const IOS_ALTERNATIVE_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/

export type IosInstallEnvironment = {
  userAgent: string
  maxTouchPoints: number
  standalone: boolean
}

export function isIosSafari(environment: IosInstallEnvironment) {
  const iosDevice = IOS_DEVICE.test(environment.userAgent)
    || (/Macintosh/.test(environment.userAgent) && environment.maxTouchPoints > 1)
  const webkitSafari = /WebKit/.test(environment.userAgent) && !IOS_ALTERNATIVE_BROWSERS.test(environment.userAgent)
  return iosDevice && webkitSafari
}

export function shouldShowIosInstallGuide(environment: IosInstallEnvironment) {
  return isIosSafari(environment) && !environment.standalone
}
