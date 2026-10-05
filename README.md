<div align="center">
  <img src="apps/mobile/assets/images/icon.png" alt="Kimbo Logo" width="140"/>
  <h1>Kimbo</h1>
  <p><strong>A health companion that lives on your phone, not just in an app.</strong></p>
  <p>Say what you ate, snap your plate or start a walk. Kimbo turns it into calories, protein and steps, and reacts to your day from a <b>Dynamic Island</b> that floats over every app.</p>
  <br/>
  <p>
    <img src="https://img.shields.io/badge/Android-Expo_SDK_57-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android"/>
    <img src="https://img.shields.io/badge/Backend-AWS_Lambda-FF9900?style=for-the-badge&logo=awslambda&logoColor=white" alt="AWS Lambda"/>
  </p>
  <p>
    <a href="https://github.com/herin7/kimbo/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/herin7/kimbo/ci.yml?branch=main&style=flat-square&label=ci" alt="CI"></a>
    <a href="https://github.com/herin7/kimbo/issues"><img src="https://img.shields.io/github/issues/herin7/kimbo?style=flat-square" alt="Issues"></a>
    <a href="https://github.com/herin7/kimbo/stargazers"><img src="https://img.shields.io/github/stars/herin7/kimbo?style=flat-square" alt="Stars"></a>
  </p>
</div>

---

Most health apps fail the same way: logging takes effort, so you stop logging. Typing every meal
into a database search, opening the app to start a walk, digging through charts to see whether
today went well.

**Kimbo** takes that effort out. Tap the island at the top of your screen in whatever app you're
using, say *"two rotis and dal"*, and Kimbo transcribes it, works out the nutrition, and asks you
to confirm without opening the app. Kimbo himself sits in that island, happy, worried or fired up
depending on how your day is going.

## ✨ Key Features

* **🏝️ Kimbo Mode island**: a floating Dynamic Island-style overlay with today's calories, protein
  and steps. Start a walk, end a walk or log a meal by voice from any app.
* **🎙️ Three ways to log a meal**: voice, photo or manual entry, all ending on the same editable
  confirmation screen.
* **✅ You make the final call**: AI output becomes a draft, never a saved fact. Nothing is logged
  until you confirm it.
* **🚶 Live walks**: Health Connect and the Android step counter feed live session steps, elapsed
  time and distance, kept running by a foreground service even when Kimbo is closed.
* **🔔 Android 16 Live Updates**: promoted progress notifications where supported, with a standard
  ongoing notification as fallback.
* **🧸 A companion with moods**: Kimbo is a Rive character who reacts to what you just did, whether
  that's a heavy meal, a protein win or a long day without moving.
* **📈 Progress from facts**: streaks, a consistency calendar and weekly insight, all calculated by
  deterministic domain code. Models never invent numbers.
* **📴 Local-first**: meals and walks land in on-device SQLite first and sync when the network
  allows. Offline actions still count.

## 🛠️ Tech Stack

![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Kotlin](https://img.shields.io/badge/Kotlin-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white)
![Rive](https://img.shields.io/badge/Rive-1D1D1D?style=for-the-badge&logo=rive&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS_Lambda-FF9900?style=for-the-badge&logo=awslambda&logoColor=white)
![Amazon RDS](https://img.shields.io/badge/PostgreSQL_on_RDS-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Bedrock](https://img.shields.io/badge/Amazon_Bedrock-01A88D?style=for-the-badge&logo=amazonaws&logoColor=white)
![Sarvam](https://img.shields.io/badge/Sarvam_Speech-111111?style=for-the-badge&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)
![EAS](https://img.shields.io/badge/EAS_Build_%26_Update-4630EB?style=for-the-badge&logo=expo&logoColor=white)

## 🏛️ How It Works: Architecture

<div align="center">
  <img src=".github/assets/architecture.png" alt="Kimbo architecture" width="100%"/>
  <p><em><a href="https://excalidraw.com/#json=VfXKgBeC_CFlNA5IZ0UvZ,LVTCfoHBGqHk7fYNYlcpFQ">Open the editable diagram on Excalidraw</a></em></p>
</div>

The API and its Postgres database both run in AWS Mumbai (`ap-south-1`), next to the Bedrock models.

1. **Capture (phone)**: a meal comes in as voice, a photo or text, from inside the app or straight
   from the island. Voice is uploaded for transcription; photos and text go to food analysis.
2. **Understand (API on Lambda)**: Fastify verifies the session, then runs the food-analysis
   pipeline: voice → **Sarvam** speech-to-text → **Amazon Bedrock** (a text model for words, a
   vision model for photos) → raw JSON → **Zod** validation → a normalised meal candidate.
3. **Confirm (phone)**: the candidate becomes an editable draft. Only when you confirm is it saved,
   first to on-device SQLite, then synced to Postgres through Drizzle repositories.
4. **Move (Android native)**: a Kotlin Expo module reads Health Connect and the step-counter
   sensor. A foreground service keeps a walk alive and drives the notification and the island.
5. **React (everywhere)**: shared `@kimbo/domain` code turns recorded facts into totals, targets,
   streaks and Kimbo's mood. The same calculation runs in the app and on the island.

**The island is a thin shell:** Android owns only the overlay window. Health data, Kimbo's mood
and the real work behind every button stay in React Native. The island displays a snapshot and
sends taps back as durable actions, so nothing is lost if JavaScript is asleep.

## 📱 The App

| Screen | What it does |
|---|---|
| **Onboarding** | A few questions → calorie, protein and step targets |
| **Today** | Kimbo's take on your day, progress rings and quick meal capture |
| **Meal** | Voice, camera or manual capture → one editable confirmation |
| **Activity** | Step goal, live walk metrics and the Kimbo Mode toggle |
| **Progress** | Consistency calendar, streaks, multi-month history and weekly insight |
| **Profile** | Goals, account and sign-out |
| **Island** | Compact pill → expanded card with today's numbers, walk controls and voice logging |

Dark and light themes, springy motion, haptics and reduced-motion support, all from one set of
semantic design tokens. Every permission (mic, camera, notifications, activity, overlay) is asked
for in context, and a denial never blocks the rest of the app.

## 🚀 Shipping

* **CI** (`.github/workflows/ci.yml`) runs typecheck, tests and a full build on every push and PR.
* **App builds** use EAS. The `preview` profile produces an installable arm64 APK; `production`
  produces an app bundle.
* **OTA updates** (`.github/workflows/preview-ota.yml`) publish JavaScript-only changes to the
  `preview` channel on demand. Changes to the Kotlin module need a new build.
* **Backend** is bundled into a single Lambda package (`npm run build:lambda`) and deployed with a
  private, idempotent script. Database migrations use Drizzle (`npm run db:migrate`).

## 💻 Get It Running Locally

### Prerequisites
* [Node.js](https://nodejs.org/) 22+ and npm
* PostgreSQL
* Android Studio with Android SDK 36, and JDK 17
* A [Sarvam](https://www.sarvam.ai/) API key and Amazon Bedrock access (or `AI_PROVIDER=mock` to
  run without either)

<details>
<summary>Click to view step-by-step setup</summary>

1. **Clone and install**
   ```sh
   git clone https://github.com/herin7/kimbo.git
   cd kimbo
   npm install
   cp .env.example .env                              # DATABASE_URL, AI_PROVIDER, Sarvam + Bedrock keys
   cp apps/mobile/.env.example apps/mobile/.env.local
   ```
   Backend secrets must never use an `EXPO_PUBLIC_` prefix.

2. **Create the database**
   ```sh
   createdb -h 127.0.0.1 -U postgres kimbo
   npm run db:migrate --workspace @kimbo/api
   npm run db:seed-demo --workspace @kimbo/api      # optional: demo accounts with history
   ```

3. **Start the API** (port 3000)
   ```sh
   npm run dev:api
   ```

4. **Run the app**
   ```sh
   cd apps/mobile
   npx expo run:android
   ```
   The Android emulator reaches your computer at `10.0.2.2:3000`. On a physical device, set
   `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` to your computer's LAN address.

Kimbo ships a custom native module, so it needs a development or native build. Expo Go won't work.

</details>

<details>
<summary>Building the Android APK locally</summary>

```powershell
cd apps/mobile
npx expo prebuild --platform android --clean --no-install
cd android
.\gradlew.bat assembleDebug
```

The APK lands in `apps/mobile/android/app/build/outputs/apk/debug/`. Release signing is not
committed; bring your own keystore or build through EAS.

</details>

## 🧪 Tests

```sh
npm run typecheck   # every workspace
npm test            # Vitest: targets, meal totals, progress, Kimbo reactions, API validation
```

Health Connect, real sensors and the island overlay still need a physical Android device.

## 📂 Project Structure

```
kimbo/
├── apps/
│   ├── mobile/     Expo app: routes (src/app), features, design system, Kotlin island module
│   └── api/        Fastify API: auth, food analysis, health data, Drizzle migrations, Lambda bundle
├── packages/
│   ├── contracts/  Shared Zod schemas and types
│   └── domain/     Framework-free targets, totals, progress and Kimbo's reactions
└── .github/        CI, OTA workflow and README assets
```

## 🙏 Attribution

Kimbo's face is [Mood interaction by ardraawork](https://rive.app/marketplace/27639-52202-mood-interaction/)
from the Rive Marketplace, used under the CC BY license.

Kimbo is not a medical device and makes no claim of clinical precision.
