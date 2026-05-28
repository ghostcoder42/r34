<h1 align="center">
  <img alt="logo" src="./assets/icon.png" width="124px" style="border-radius:10px"/><br/>
  r34</h1>

> Mobile app built with [Expo](https://expo.dev) + React Native + NativeWind.

## Quick start

```sh
git clone <repo-url>
cd r34
bun install
```

Run the app:

```sh
bun ios      # iOS
bun android  # Android
bun start    # Metro dev server (connect via Expo Go / dev client)
```

## Build

Production builds run through EAS (`eas.json`, `app.config.ts`). A GitHub
release triggers `.github/workflows/release.yml`, which builds the Android APK
and attaches it to the release. See the workflow file for required secrets.

## Scripts

| Command | Description |
|---------|-------------|
| `bun start` | Start Metro dev server |
| `bun ios` / `bun android` | Run on device/simulator |
| `bun run lint` | Biome lint + format check |
| `bun run type-check` | TypeScript (`tsc --noemit`) |
| `bun run test` | Jest unit tests |
| `bun run check-all` | lint + type-check + test |
