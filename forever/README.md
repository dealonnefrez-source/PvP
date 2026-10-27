# Forever — strona polskiej gildii WoW

Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui i Supabase Auth/PostgreSQL.

## Prosty dostęp do strony

1. Użytkownik rejestruje się, podając wyłącznie adres e-mail i hasło.
2. Otrzymuje wiadomość z linkiem potwierdzającym.
3. Kliknięcie linku potwierdza konto, tworzy sesję i otwiera panel główny.
4. Dane postaci są całkowicie opcjonalne. Zakładka **Twój Profil** (`/profile`) pozwala zapisywać wybrane pola albo wyczyścić wszystkie.

Nie ma wymuszonego onboardingu, wyboru roli ani wymogu kompletności postaci. Stary adres `/onboarding` jedynie przekierowuje do `/profile`, aby zachować działanie istniejących odnośników. Logowanie na istniejące konto również prowadzi prosto do panelu.

Każde konto z potwierdzonym adresem e-mail ma dostęp członka gildii. Nie jest to system zaproszeń ani zatwierdzania członkostwa.

## Uruchomienie lokalne

Wymagany Node.js 24 LTS i npm.

```powershell
Set-Location E:\WoW\PvP\forever
npm ci
Copy-Item .env.example .env.local
```

Wypełnij `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TWOJ_PROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TWOJ_KLUCZ_PUBLICZNY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DISCORD_WEBHOOK_URL=
```

Nigdy nie używaj klucza `secret` ani `service_role` w zmiennych `NEXT_PUBLIC_*`. Klucz administracyjny nie jest potrzebny aplikacji.

```powershell
npm run dev
```

Otwórz `http://localhost:3000`. Bez konfiguracji Supabase aplikacja wyświetli instrukcję konfiguracji zamiast symulować logowanie.

## SQL — jedna tabela aplikacji

W **Supabase → SQL Editor → New query** uruchom jako `postgres` cały plik:

**[202610270002_optional_profiles.sql](supabase/migrations/202610270002_optional_profiles.sql)**

Ten sam skrypt obsługuje oba przypadki:

- **Pusta baza:** tworzy wyłącznie `public.profiles`. Konta, hasła i potwierdzanie e-maila obsługuje istniejąca w Supabase tabela `auth.users`.
- **Baza po starej migracji 001:** usuwa wymóg onboardingu, stare RPC `complete_onboarding` i kolumnę `onboarded_at`, zmienia zasady dostępu oraz zachowuje konta i dane postaci. Nie usuwa istniejących wydarzeń, zapisów, grup ani ról administracyjnych.

Uruchom skrypt raz i wdrażaj go razem z nową wersją aplikacji. Jeśli istnieją niestandardowe tabele/polityki inne niż nasz schemat, najpierw sprawdź ich zgodność. Skrypt nie resetuje bazy i nie używa `DROP ... CASCADE`.

**Nie uruchamiaj starej migracji 001 w nowym projekcie.** Jest zachowana jako historia i materiał testowy dla aktualizacji istniejącej bazy. Wykonanie całej historii przez `supabase db push` utworzy również dawne tabele wydarzeń/grup; dla minimalnej instalacji użyj bezpośrednio pliku 002 w SQL Editor.

### Zawartość profilu

| Kolumna | Znaczenie |
| --- | --- |
| `id` | Identyfikator konta z `auth.users` |
| `character_name` | Opcjonalna nazwa postaci |
| `realm` | Opcjonalny serwer |
| `race`, `character_class` | Opcjonalna rasa i klasa |
| `primary_professions` | Od zera do dwóch profesji głównych |
| `last_active_at` | Ostatnia aktywność na stronie |
| `created_at`, `updated_at` | Znaczniki czasu |

Każde pole postaci można zapisać osobno. Puste pola tekstowe i niewybrane opcje zapisują się jako `NULL`, brak profesji jako pusta tablica. Katalog jest nadal startowym zestawem w stylu Retail, bez wymuszania kombinacji rasa/klasa. Techniczne wartości są angielskie, a etykiety interfejsu polskie.

### RLS i uprawnienia

- Brak anonimowego dostępu do profili i funkcji aktywności.
- Potwierdzone konto może odczytywać profile gildii bez uzupełniania własnej postaci.
- Niepotwierdzone konto może odczytać jedynie własny profil; nie może go aktualizować ani rejestrować aktywności.
- Użytkownik może zmieniać tylko własne pola postaci. Nie może zmieniać identyfikatorów, znaczników czasu ani starych ról gildii.
- Profile tworzy automatycznie wyzwalacz rejestracji. Skrypt uzupełnia także brakujące profile dla wcześniej założonych kont.
- Aktualizacje czasu aktywności wykonuje funkcja z czasem serwera, nie przeglądarka.

## Potwierdzanie adresu e-mail

W Supabase:

1. Włącz Email oraz **Confirm email** w ustawieniach dostawcy logowania.
2. W **Authentication → URL Configuration** ustaw Site URL na `http://localhost:3000`, a na produkcji na pełny adres HTTPS strony.
3. Dodaj do Redirect URLs dokładny adres `http://localhost:3000/auth/callback` i odpowiednik produkcyjny.
4. W szablonie **Confirm signup** ustaw polski temat i treść. Link ma mieć następującą postać:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Potwierdź konto w gildii Forever</a>
   ```

Ta wersja działa również po otwarciu linku na innym urządzeniu. `/auth/confirm` weryfikuje token, zapisuje sesję w ciasteczkach i przekierowuje od razu do `/dashboard`. Uzupełnianie profilu nie jest częścią tego procesu. Dostępny jest również `/auth/callback` dla przepływu PKCE.

Przed publicznym uruchomieniem skonfiguruj SMTP, limity rejestracji i odpowiednie zabezpieczenia Supabase Auth. Minimalna długość nowego hasła w aplikacji wynosi 12 znaków.

## Wdrożenie na Vercel

Ustaw katalog główny projektu na `forever`, jeśli importujesz nadrzędny katalog. Dodaj zmienne:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` — pełny adres strony, bez końcowego `/`

Wykonaj Redeploy po zmianie zmiennych: wartości `NEXT_PUBLIC_*` są odczytywane przy kompilacji. Dostosuj też Site URL i Redirect URLs w Supabase. Nie dodawaj prawdziwych kluczy do repozytorium.

## Sprawdzanie działania

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Testy PostgreSQL uruchamiają rzeczywiste pliki SQL w PGlite z testową implementacją `auth.users` i `auth.uid()`. Pokrywają zarówno nową instalację, jak i przejście ze starego schematu, zachowanie danych, dostęp bez danych postaci, RLS i zapis częściowego/pustego profilu. Osobne testy dawnego schematu pozostają testami historycznej migracji 001, a nie wymaganiami obecnego systemu.

Test na prawdziwym Supabase i skrzynce e-mail:

1. Zarejestruj konto i sprawdź, że formularz zawiera tylko e-mail oraz hasło.
2. Kliknij link z wiadomości. Oczekiwany rezultat: panel główny, bez formularza postaci po drodze.
3. Bez uzupełniania profilu odśwież panel i sprawdź dostęp.
4. Otwórz **Twój Profil**, zapisz tylko jedno pole, następnie wyczyść pola i zapisz ponownie.
5. Wyloguj się i zaloguj ponownie. Nadal nie powinno być obowiązkowego onboardingu.

Aktywność oznacza korzystanie ze strony, nie obecność w WoW. Panel wysyła żądanie po otwarciu widocznej karty, co pięć minut i po powrocie do karty. Baza ogranicza zapisy do jednego na minutę. Lista aktywnych obejmuje ostatnie 15 minut; odśwież stronę, aby ją zaktualizować. Żądania aktywności muszą pochodzić z origin określonego przez `NEXT_PUBLIC_SITE_URL`.

## Role gildii, członkowie i otwarte wydarzenia — aktualna wersja

Po migracji 003 uruchom raz jako `postgres` **[202610270004_guild_roles_open_events.sql](supabase/migrations/202610270004_guild_roles_open_events.sql)**. To pełny skrypt potrzebny tej wersji, nie tylko dodanie kolumny. Nie powtarzaj wcześniejszych migracji. Zachowuje dane i zamienia dawną rolę `admin` na `guild_master`, także na istniejących kontach. Role to `member` (domyślna), `officer` i `guild_master`.

- `/roster` (**Członkowie**) pokazuje wszystkie konta z profilami, również niepotwierdzone i bez postaci, po 50 na stronę. Nie ujawnia e-maili.
- Potwierdzony zwykły członek widzi listę bez kontrolek edycji. Oficer i mistrz gildii mogą nadać **każdą** rolę każdemu, także sobie oraz innym zarządzającym. Nie ma zabezpieczenia ostatniego mistrza gildii — to celowo równorzędne uprawnienia według obecnych wymagań. Przed zmianą jest potwierdzenie.
- Zmiana roli odbywa się przez chronione RPC `set_guild_role`, a nie publiczne `UPDATE guild_role`. Sprawdzenie uprawnień jest również w bazie; ukrycie przycisku nie jest jedynym zabezpieczeniem.
- Po samodegradacji kontrolki zarządzania znikają. Jeśli nikt nie ma już uprawnień, właściciel projektu może je przywrócić w SQL Editor:

  ```sql
  update public.profiles
  set guild_role = 'guild_master'
  where id = 'TUTAJ_UUID_KONTA';
  ```

- Każde potwierdzone konto może utworzyć wydarzenie, bez uzupełniania postaci. Wymagane są tytuł, rozpoczęcie i opis „co będziemy robić”. Kategoria jest opcjonalna; brak oznacza `other` (**Inne**). Dostępne są PvP, Rajd na miasto, Premade BG i Inne.
- Zakończenie jest opcjonalne: bez niego aplikacja ustala godzinę trwania. Cele składu również są opcjonalne — same zera oznaczają otwarty skład, bez wykazywania fikcyjnych braków czy nadwyżek. Nadal obowiązują zapisy z rolą na dane wydarzenie.
- Autor może odwołać własne wydarzenie; oficer i mistrz gildii mogą zarządzać wszystkimi. Zwykły członek nie zmienia cudzych wydarzeń ani ról.
- Kalendarz, lista i szczegóły odczytują **aktualną rolę autora z `profiles`**. Dla oficera i mistrza gildii pojawia się czerwony akcent i etykieta **Wydarzenie oficerskie**. Zmiana roli wpływa też na wcześniejsze wydarzenia, po odświeżeniu; usunięty autor nie otrzymuje wyróżnienia.
- Po zmianie ról aplikacja unieważnia widoki; inni użytkownicy widzą zmiany po odświeżeniu. Nie ma subskrypcji Realtime.

Po uruchomieniu migracji 004 wdróż nowy kod na Vercel. Sprawdź jako członek tworzenie wydarzenia oraz brak edycji ról. Następnie jako oficer zmień rolę autora i sprawdź czerwone wyróżnienie wydarzenia.

## Wydarzenia PvP i kalendarz — poprzedni etap 003

Poniższy opis dokumentuje etap 003. W aktualnej wersji **pierwszeństwo mają zasady migracji 004 opisane powyżej**: tworzenie dla każdego, `guild_master` zamiast `admin`, opcjonalne cele składu i kategoria.

Po migracji 002 uruchom **raz** w Supabase SQL Editor jako `postgres`:

**[202610270003_pvp_events.sql](supabase/migrations/202610270003_pvp_events.sql)**

Nie uruchamiaj ponownie migracji 001 ani 002. Plik 003 obsługuje zarówno bazę minimalną po 002, jak i bazę z dawnymi wydarzeniami po 001 + 002. Zachowuje istniejące profile, role i zapisy. Dodaje rolę gildii (`guild_role`) do profili oraz tabele `events` i `event_rsvps`, jeśli jeszcze ich nie ma. Nowe konta mają rolę `member`. Nie wraca żaden obowiązkowy onboarding.

### Nadanie uprawnień oficera

W Supabase Authentication → Users znajdź UUID konta. Uruchom jako `postgres`, podstawiając rzeczywisty UUID:

```sql
update public.profiles
set guild_role = 'officer'
where id = 'TUTAJ_UUID_KONTA';
```

Właściciel projektu może również nadać `admin`. Członkowie nie mogą zmieniać tej kolumny przez aplikację ani API. Nie wystarczy dodać roli do metadanych konta Auth — źródłem uprawnień jest kolumna `profiles.guild_role`.

### Korzystanie

- **Wydarzenia** (`/events`) są dostępne z panelu głównego i profilu.
- Kalendarz miesięczny zaczyna tydzień od poniedziałku. Strzałki zmieniają miesiąc; lista pod kalendarzem pokazuje wydarzenia rozpoczynające się w danym miesiącu, także odwołane.
- Oficer/administrator ma przycisk **Zaplanuj wydarzenie** (`/events/new`): nazwa, aktywność (Premade BG, Arena, Rajd na miasto lub Inne), początek, koniec, docelowy skład i opcjonalny opis.
- Formularz odczytuje czas lokalny przeglądarki i zapisuje go jako UTC. Kalendarz i szczegóły zawsze wyświetlają czas polski `Europe/Warsaw`, z uwzględnieniem czasu letniego. Nieistniejące godziny wiosennej zmiany czasu są odrzucane. Dla podwójnej godziny jesiennej przeglądarka wybiera pierwsze wystąpienie.
- Gracz otwiera szczegóły (`/events/<UUID>`), wybiera **Tank, Healer lub DPS** i klika **Biorę udział**. Można później zmienić rolę albo wycofać udział. Rola jest przypisana wyłącznie do wydarzenia, nie do profilu.
- Pusty profil nie blokuje zapisu. Na liście uczestników pojawia się nazwa postaci, a przy jej braku identyfikator gracza. E-maile nie są ujawniane. Nazwę można później uzupełnić w „Twój Profil”.
- Trzy kolumny składu pokazują liczby zapisanych, cel i braki. Cele **nie są limitami miejsc** — nadwyżka jest oznaczona osobno; nie ma automatycznej rezerwy ani przydziału miejsc. Kolejność to czas pierwszego zapisu.
- Zapisy i zmiana roli zamykają się z rozpoczęciem wydarzenia, po odwołaniu lub zakończeniu. Wycofać własny udział można także później. Oficer może odwołać wydarzenie bez kasowania listy uczestników.
- Zapisy innych graczy są widoczne po odświeżeniu; brak subskrypcji Realtime. Kalendarz pokazuje do 1000 wydarzeń w pobieranym zakresie, a szczegóły do 1000 uczestników. Przekroczenie limitu powoduje jawny błąd zamiast pokazania niepełnych liczb.

### Zabezpieczenia i Discord

RLS pozwala tworzyć/zarządzać wydarzeniami wyłącznie oficerom i administratorom. Potwierdzone konta mogą czytać wydarzenia i listy zapisów. Uczestnik zmienia tylko własne zgłoszenie; nawet oficer nie zmienia cudzego RSVP. Klucz główny `(event_id, profile_id)` zapobiega duplikatom. RPC `save_event_rsvp` działa z uprawnieniami wywołującego i aktualizuje tylko rolę — nie pozwala podmieniać uczestnika ani wydarzenia. Wyzwalacz bazy sprawdza zamknięcie zapisów również przy bezpośrednim wywołaniu API.

Opcjonalny `DISCORD_WEBHOOK_URL` w Vercel uruchamia powiadomienie po utworzeniu wydarzenia. Nie używaj prefiksu `NEXT_PUBLIC_`. Nieudana dostawa nie usuwa wydarzenia; oficer zobaczy ostrzeżenie i link do poprawnie utworzonego wydarzenia. Nie ma automatycznych ponowień dostawy. Brak webhooka oznacza wyłączone powiadomienia i nie blokuje planowania.

### Test po wdrożeniu

1. Uruchom migrację 003 i nadaj wybranemu kontu rolę oficera.
2. Wdróż nową wersję na Vercel.
3. Jako oficer utwórz przyszłe wydarzenie z docelowym składem i sprawdź jego datę w kalendarzu.
4. Jako zwykły gracz z pustym profilem sprawdź brak formularza planowania, a następnie zapisz się jako Healer.
5. Zmień rolę na DPS — licznik Healerów powinien zmaleć, a DPS wzrosnąć, bez duplikatu osoby.
6. Wycofaj udział. Następnie zapisz się ponownie i odwołaj wydarzenie jako oficer: lista pozostaje, ale nowe zapisy/zmiana roli są blokowane.

## Język i kolejne etapy

Wszystkie obecne i przyszłe formularze, tabele, role, błędy oraz powiadomienia muszą być po polsku (`lang="pl"`). Wspólne etykiety znajdują się w [wow.ts](src/lib/wow.ts) i [labels.ts](src/lib/labels.ts).

Lista członków z filtrami i wyszukiwanie grup pozostają kolejnymi etapami. Podstawowe konta i profile nadal działają bez danych postaci. Wydarzenia wymagają dodatkowej migracji 003 opisanej powyżej.
