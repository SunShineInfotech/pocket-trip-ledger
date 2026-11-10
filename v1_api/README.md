# Pocket Trip Ledger PHP API

This API uses MySQL/MariaDB and the same JSON `status` / `message` / `data` response style as Homennys. It is a separate service from the TanStack Start frontend.

## Setup

1. Create the MySQL database.
2. For a new database, import `../sql/schema.sql`. If this database already has the first version of the schema, apply `../sql/migrations/001_trip_member_family_snapshot.sql` instead. Then run `../sql/migrations/002_seed_vraj_account.sql` and `../sql/migrations/003_trip_admins.sql` to provision the starter account and multi-admin trip support.
3. Configure `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` as server environment variables. For local development, `config.local.php` is git-ignored. This checkout has a private local config using the supplied database name and user, with `DB_HOST=localhost`; `localhost` works when PHP and MySQL run on the same machine. If the database is hosted remotely, replace `DB_HOST` with the provider's MySQL hostname and allow remote MySQL access for this computer.
4. Set `APP_ALLOWED_ORIGINS` to the exact frontend origins, separated by commas. Set a long random `APP_BOOTSTRAP_KEY`.
5. For OTP delivery set `SMS_API_URL` to your SMS gateway endpoint and optionally `SMS_API_TOKEN` and `SMS_SENDER`. The gateway should accept JSON `{ "to", "sender", "message" }` and respond with a 2xx status. With `APP_ENV=local`, requested OTPs are returned as `debug_otp` so local setup can be used without an SMS account.
6. Deploy this folder under the same PHP host that serves the frontend, or point the frontend API client at this folder. All endpoints accept JSON POST requests.

The frontend posts to `https://sunshineproduct.in/trip/v1_api` by default. If the API is hosted at another origin or path, set `VITE_POCKET_API_URL` to the API folder URL before building the frontend.

The initial account is created once with `auth.php` type `0`, using the bootstrap key. That creates the first administrator and their family. Sign in with type `5` using the registered mobile number and password. Types `1` and `2` remain available for OTP-based clients.

## Authentication

Except for bootstrap and requesting/verifying OTP, send `Authorization: Bearer <token>`. Tokens are random, stored only as SHA-256 hashes in MySQL, and expire after 30 days. Sign out with `auth.php` type `4`.

## Endpoints

All success responses use `{ "status": "success", "message": "...", "data": ... }`; errors use `{ "status": "error", "message": "..." }`.

| Endpoint | Type | Purpose |
| --- | --- | --- |
| `auth.php` | 0 | Bootstrap the first administrator; requires `bootstrap_key`, name, mobile, email, and family name |
| `auth.php` | 1 / 2 / 3 / 4 / 5 | Request OTP / verify OTP / current user / sign out / mobile and password sign-in |
| `family.php` | 1 / 2 / 3 | List families / add family / move a user to a family |
| `user.php` | 1 / 2 | List members / add or update a member |
| `trip.php` | 1 / 2 / 3 | List trips / create trip / trip details, families, and travellers |
| `category.php` | 1 / 2 | List shared and trip categories / add a trip category |
| `expense.php` | 1 / 2 / 3 | List expenses with splits / add or update expense / soft-delete expense |
| `settlement.php` | 1 | Get person balances, family totals, and suggested family-to-family payments; optional `through_date` limits expenses by date |
| `notification.php` | 1 / 2 | List notifications / mark one as read |

Any trip member can be recorded as the payer. Each expense can be split among any selected members of that trip, and the split must total the expense amount exactly to the cent. `settlement.php` calculates each member's paid and consumed totals, groups them by family, and returns suggested family-to-family payments. Trip membership stores a family snapshot so a later family change in the people list does not rewrite a past trip's settlement. These balances are calculated from trip expenses and splits; totals are not duplicated in SQL.

The frontend reads trips, families, people, expenses, categories, and notifications from this API. Only the bearer session token and selected trip ID are kept in browser storage; ledger records are saved in MySQL through these endpoints. For a regular PHP/Apache host with a file manager, run `npm run build:upload` and upload the contents of `dist-upload/` into `/trip/build_v1/`. The generated folder includes `index.html`, assets, and an `.htaccess` rule that serves the SPA for deep links such as `/people` and `/directlogin/...`. Alternatively, `npm run build:deploy` creates the Cloudflare Worker build; that output requires Worker hosting and a route for `/trip/build_v1/*`. The PHP API source and SQL migrations must also be deployed/applied separately.
