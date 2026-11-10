# Pocket Trip Ledger

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pocket-trip-ledger.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b3761d19-9534-4c3a-958e-7df66d923b4a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## PHP API and database

The separate MySQL schema and PHP API endpoints are in [`sql/schema.sql`](sql/schema.sql) and [`v1_api/`](v1_api/README.md). Configure a PHP/MySQL host using the steps in the API README. The current frontend still runs its included sample data in local storage; connecting the UI to the hosted API requires setting up the API URL and sign-in flow in a later integration step.
