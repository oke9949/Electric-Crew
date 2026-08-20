# Electric Crew 6.0 kiadási jegyzet

Az Electric Crew 6.0 az 1.0-s projekt- és készletkezelési magot egységes vállalatirányítási felületté bővíti.

## Fő folyamat

1. A felhasználó Supabase Auth-tal jelentkezik be.
2. A cégkontextus és a szerepkör RLS-en keresztül szűri az adatokat.
3. A projektekhez rendszerek, feladatok, munkaórák, anyagmozgások és dokumentumok kapcsolhatók.
4. Az operatív központ a helyszíni problémákat és igényeket kezeli.
5. A pénzügyi modul az ügyfél–ajánlat–számla folyamatot követi.
6. A riportok és a döntéstámogató a cég saját adataiból készít vezetői jelzéseket.

## Jogosultsági modell

- OWNER, ADMIN, MANAGER: cégvezetési és pénzügyi hozzáférés.
- MEMBER: operatív cégadatok.
- A pénzügyi táblák kizárólag vezetői szerepkörrel olvashatók és módosíthatók.
- A dokumentumok privát bucketben, cégazonosítóval kezdődő útvonalon tárolódnak.
- A frontend kizárólag Supabase publishable kulcsot használ.

## Telepítési ellenőrzőlista

- [ ] A migráció dry-runja hibamentes.
- [ ] A migráció éles futtatása sikeres.
- [ ] A VITE_SUPABASE_URL be van állítva.
- [ ] A VITE_SUPABASE_PUBLISHABLE_KEY be van állítva.
- [ ] Az Auth redirect URL tartalmazza az éles domaint.
- [ ] Egy OWNER és egy MEMBER fiókkal ellenőrizve van az RLS.
- [ ] Dokumentumfeltöltés, letöltés és törlés tesztelve van.
- [ ] A GitHub Actions build zöld.
