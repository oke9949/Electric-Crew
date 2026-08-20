# Változásnapló

## 10.0.1 – Document Intelligence Stabilized (2026-08-20)

### Javítva és ellenőrizve

- Stabilizált production webes és Android-kiadás a 10.0 dokumentum-intelligencia funkcióihoz.
- Mobil- és asztali bejelentkezési felület, jelszó-visszaállítás és AI API-hozzáférés ellenőrizve.
- Dokumentum-anyaglista, AI pénzügyi összesítő és helyben csomagolt térképmodul production ellenőrzése.
- GitHub Actions minőségellenőrzés és verziózott APK-kiadás egységesítve.

## 10.0.0 – Document Intelligence (2026-08-20)

### Új

- AI-alapú számlafeldolgozás külön anyagtételekkel és pénzügyi bejegyzéssel.
- Dokumentum anyaglista nettó tételértékekkel és forrásfájlokkal.
- Vezetői pénzügyi összesítő bevétel, kiadás, egyenleg és ÁFA bontásban.
- DWG gépészeti rajzok ellenőrzött szöveg- és berendezéskinyerése.
- A feltöltött számla 11 tételének és a DWG berendezésjelöléseinek feldolgozott mintadata.

### Javítva

- Az alkalmazás indulását blokkoló külső Leaflet CDN-függőség megszüntetve.
- A térkép és az oldalsáv Android WebView-ban is helyi, verziórögzített csomagból indul.
- Dokumentum-AI eredményei idempotensen frissítik az anyag- és pénzügyi táblákat.
- Cégszintű RLS és explicit Data API-jogok az új dokumentum-intelligencia táblákon.

## 6.0.1 – Collaboration & Intelligence (2026-08-20)

### Új

- Valós idejű céges és projekt-chatszobák.
- Vállalati adatokra épülő Electric Crew AI-asszisztens.
- Számla-, PDF- és képdokumentumok AI-feldolgozása.
- Projekt- és önkéntes munkatársi helymegosztásos térkép.
- Automatikusan verziózott Android APK-fájlnév és GitHub Release.

### Javítva

- Az AI szerverfunkció Vercel-fordítása és jogosultság-ellenőrzése.
- Az Android verziókód és verziónév most a `package.json` kiadási verziójából készül.

## 6.0.0 – Enterprise Operations (2026-08-20)

### Új

- Operatív központ problémákhoz, segítségkérésekhez, szerszámigényekhez és beszerzéshez.
- Ügyfél-, ajánlat- és számlakövető pénzügyi modul.
- Vezetői riportok projekt-, feladat-, munkaóra- és pénzügyi KPI-okkal.
- Helyben futó döntéstámogató elemzés blokkolt feladatokhoz, alacsony készlethez, csúszó projektekhez és lejárt számlákhoz.
- Teljes, verziózott Supabase migráció cégszintű RLS-sel és privát dokumentumtárral.
- GitHub Actions buildellenőrzés és rögzített dependency-verziók.

### Javítva

- Vite környezeti változók TypeScript-típusai.
- A Node/Vite TypeScript projekt hibás emit-konfigurációja.
- Egységes 6.0 verziójelzés és kiadási dokumentáció.

