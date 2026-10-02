# DRSMILE Expo Dashboard

Internal appointment operations dashboard for DRSMILE Expo events.

## Live site

https://joslyn-drsmile.github.io/drsmile-expo-dashboard/

The site uses Supabase for shared data and account access. GitHub Pages hosts the static Next.js frontend.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The Supabase browser key is a public publishable key; database Row Level Security protects customer records from anonymous access.

## Checks

```bash
npm run check
```

Every push to `main` builds and publishes the site with GitHub Actions.

Customer and appointment records are stored only in Supabase and are not committed to this public repository.
