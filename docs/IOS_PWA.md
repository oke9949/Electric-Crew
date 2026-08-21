# Electric Crew iPhone és iPad PWA

Az Electric Crew App Store-csomag nélkül, Safari webalkalmazásként telepíthető iPhone-ra és iPadre.

## Telepítés

1. Nyisd meg az Electric Crew production URL-jét Safari böngészőben.
2. Koppints a **Megosztás** gombra.
3. Válaszd a **Hozzáadás a Főképernyőhöz** lehetőséget.
4. Indítsd el az Electric Crew ikonját a Főképernyőről.

Az útmutató csak iOS/iPadOS Safari alatt, nem telepített böngészőnézetben jelenik meg. A Chrome/Firefox iOS-változatában nincs hamis telepítési prompt.

## Offline és adatbiztonság

A service worker csak az azonos originű statikus app shellt kezeli network-first stratégiával. Nem cache-el:

- `/api/` kéréseket;
- más originen lévő Supabase/Auth/Storage kéréseket;
- `Authorization` fejlécet tartalmazó válaszokat;
- `private` vagy `no-store` cache szabályú válaszokat;
- cookie-t beállító válaszokat.

Offline állapotban a korábban betöltött app shell megnyílhat, de vállalati adatokat nem mutat helyi API-cache-ből. A projekt-, dokumentum-, chat- és AI-funkciók hálózatot igényelnek.

## iOS funkciók

- **Kamera és dokumentumfeltöltés:** a Dokumentumok oldalon külön `Fotó készítése` gomb nyitja a hátlapi kamerát; a `Fájlok kiválasztása` megőrzi a Fotók/Fájlok és több fájl lehetőségét.
- **GPS:** a helyengedély mindig felhasználói műveletre indul. Tiltás és időtúllépés esetén iOS-specifikus magyar útmutató jelenik meg.
- **Bejelentkezés:** a Supabase kliens `persistSession`, `autoRefreshToken` és callback-felismerése változatlanul aktív. Az iOS tárhelytörlése vagy a PWA eltávolítása után újra be kell jelentkezni.
- **Chat és AI:** ugyanazokat a HTTPS `/api/ai` és Supabase útvonalakat használják, mint Safari asztali nézetben; érzékeny válasz nem kerül service-worker cache-be.

## Még szükséges valós eszközteszt

- iPhone Safari és Főképernyőről indított standalone mód portré/fekvő nézetben;
- iPad Safari/standalone, split view és forgatás;
- kameraengedély, többfájlos feltöltés és nagy fotó;
- GPS `Engedélyezés egyszer`, `Használat közben` és tiltott állapot;
- Supabase session helyreállítása háttérbe küldés és rendszerfrissítés után;
- chat/AI valódi bejelentkezett sessionnel és gyenge hálózaton.

Az iOS Safari nem kínál szabványos programozható telepítési promptot, ezért a felhasználónak kézzel kell a Megosztás menüt használnia. A PWA háttérben futási, push-értesítési és fájlrendszer-képességei az iOS verziójától és rendszerbeállításaitól függenek.
