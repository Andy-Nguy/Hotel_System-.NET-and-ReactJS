# Hotel System - Mobile (React Native / Expo)

This is a minimal Expo-based React Native starter for the Hotel System project.

Quick start

1. Install dependencies (from `mobile` folder):

```bash
cd mobile
npm install
```

2. Start the app:

```bash
npm run start
# or
npm run android
npm run ios
```

Notes

- This project uses Expo (managed workflow). Install the Expo CLI if you want (optional): `npm i -g expo-cli`.
- The mobile app expects the backend API to be reachable. Configure `BASE_URL` in `src/api/authApi.ts`.
- For production, consider building native apps with `eas build` or Expo Application Services.
