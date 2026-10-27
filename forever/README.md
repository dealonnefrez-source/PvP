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

## Język i kolejne etapy

Wszystkie obecne i przyszłe formularze, tabele, role, błędy oraz powiadomienia muszą być po polsku (`lang="pl"`). Wspólne etykiety znajdują się w [wow.ts](src/lib/wow.ts) i [labels.ts](src/lib/labels.ts).

Lista członków z filtrami, wydarzenia i wyszukiwanie grup pozostają kolejnymi etapami. Nowa instalacja nie potrzebuje ich tabel. Przygotowana [funkcja Discorda](src/lib/discord.ts) pozostaje narzędziem do przyszłych powiadomień; brak webhooka nie blokuje kont ani profili.
