# Electric Crew Android

Az Electric Crew aktuális telepíthető Android APK-ja a GitHub Releases oldalon érhető el:

- [Electric-Crew-10.0.3.apk](https://github.com/oke9949/Electric-Crew/releases/download/android-v10.0.3/Electric-Crew-10.0.3.apk)
- Csomagazonosító: `hu.electriccrew.app`
- Verzió: `10.0.3`

Minden új kiadás saját verziószámot, APK-fájlnevet és GitHub Release-címkét kap.

## Kiadási aláírás

A 10.0.3 és a korábbi GitHub Actions APK-k futásonként létrehozott Android debug kulccsal készültek. A 10.0.2 és 10.0.3 tanúsítvány-ujjlenyomata eltér, ezért a 10.0.3 **nem telepíthető rá** a 10.0.2-re. Az Android aláírókulcsot nem lehet utólag lecserélni meglévő telepítésnél: a tartós kulcsra áttéréskor egyszeri eltávolítás és újratelepítés szükséges. A Supabase-ben tárolt vállalati adatok megmaradnak, de a helyi munkamenet törlődik, ezért újra be kell jelentkezni.

A következő kiadás előtt a repository tulajdonosának egyszer kell létrehoznia és biztonságosan, a GitHubon kívül is mentenie egy tartós JKS/PKCS12 kulcstárat. Ezután a repository `Actions` secretjeiben az alábbi négy érték szükséges:

- `ANDROID_KEYSTORE_BASE64`: a teljes kulcstárfájl Base64-kódolt tartalma;
- `ANDROID_KEYSTORE_PASSWORD`: a kulcstár jelszava;
- `ANDROID_KEY_ALIAS`: a kiadási kulcs aliasa, például `electric-crew`;
- `ANDROID_KEY_PASSWORD`: az aliashoz tartozó privát kulcs jelszava.

Példa helyi kulcsgenerálásra (a valódi jelszavakat ne írd parancselőzménybe, és a `.jks` fájlt soha ne commitold):

```text
keytool -genkeypair -v -keystore electric-crew-release.jks -alias electric-crew -keyalg RSA -keysize 4096 -validity 10000
```

A workflow PR-eknél debug APK-t épít ellenőrzésre, `main`/kézi kiadásnál viszont fail-closed módon kizárólag a fenti tartós kulccsal készít release APK-t. A már publikált release assetet nem írja felül. A kulcstár és a jelszavak elvesztése esetén a későbbi APK-k nem frissíthetik a telepített alkalmazást.

## Determinisztikus verziózás

A `package.json` `MAJOR.MINOR.PATCH` verziójából a workflow a `MAJOR * 10000 + MINOR * 100 + PATCH` képlettel állítja elő az Android `versionCode` értékét. A minor és patch komponens 0–99 lehet. A workflow elutasítja a már publikált legfrissebb Android-kiadásnál régebbi verziót, és az update banner csak az `Electric-Crew-VERSION.apk` nevű pontos release assetre mutat.

