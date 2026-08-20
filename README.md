# Electric Crew 10.0

Mobilközpontú, többcéges belső vállalatirányítási rendszer React, TypeScript és Supabase alapon.

## 10.0 modulok

- Supabase Auth, profilok, több cég és szerepkörök
- Projektek, műszaki rendszerek, feladatok és felelősök
- Központi anyagraktár, anyagigény és készletmozgás
- Munkanapló, csapatok és privát dokumentumtár
- Problémák, segítségkérések és szerszámigények
- Beszerzési javaslatok és jóváhagyási állapotok
- Ügyféltörzs, ajánlatok és számlakövetés
- Vezetői működési és pénzügyi riportok
- Adatalapú, helyben futó döntéstámogató elemzés
- Értesítések, auditálható műveletek és mobil PWA
- Cégszintű RLS és privát Supabase Storage
- AI dokumentumfeldolgozás, tételes anyaglista és pénzügyi összesítő
- DWG rajz-metaadatok és gépészeti berendezésjelölések feldolgozása
- Valós idejű chatszobák, vállalati AI-asszisztens és térkép

## Követelmények

- Node.js 22 vagy újabb
- pnpm 11
- Supabase projekt
- A migráció futtatásához Supabase CLI 2.115 vagy újabb

## Helyi indítás

```bash
cp .env.example .env.local
pnpm install
pnpm build
pnpm dev
```

Az `.env.local` értékei:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Kizárólag publishable kulcs kerülhet a kliensbe. A `service_role` és secret kulcsok használata a böngészőben tilos.

## Adatbázis

A teljes 6.0 migráció:

```text
supabase/migrations/20260820000000_electric_crew_v6.sql
```

Kapcsolt Supabase projekt esetén:

```bash
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

A migráció a korábbi Electric Crew Alpha táblákat is kiegészíti, minden publikus táblán engedélyezi az RLS-t, explicit Data API-jogokat ad az `authenticated` szerepnek, és privát dokumentumtár-házirendeket hoz létre.

## Ellenőrzés

```bash
pnpm typecheck
pnpm build
```

A GitHub Actions minden pushnál és pull requestnél ugyanígy ellenőrzi a projektet.

## Kiadás

Aktuális verzió: **10.0.0 – Document Intelligence**

Részletek: [CHANGELOG.md](CHANGELOG.md) és [docs/RELEASE_6.md](docs/RELEASE_6.md).

