# Kimbo

Kimbo is a mobile-first personal health assistant built around one loop:

**Capture → understand → act → see progress.**

The assignment deliberately concentrates on four complete flows: lightweight goal onboarding, confirm-before-save food capture, walking/step progress with an Android system surface, and a deterministic weekly insight. It is not intended to be a comprehensive calorie tracker or medical product.

## Product decisions

- No account wall. A locally persisted anonymous UUID keeps the first-run path short.
- AI proposes; the user decides. Voice and image results always converge on the same editable confirmation screen and are never saved automatically.
- The calorie target is labelled as an estimated starting point. Kimbo does not claim medical precision.
- Manual entry remains available when a model, network, camera, or microphone is unavailable.
- Meal and activity changes are persisted locally first with an explicit pending-sync status.
- Activity surfaces exist only during an activity. A root-level Reanimated island owns the rich in-app interaction; Android 16 promoted progress is used when available, while earlier versions can optionally show an interactive cross-app island backed by the same ongoing notification.
- Weekly numbers are computed locally from recorded facts. AI is not allowed to invent analytics.

## Intentionally out of scope

Authentication, social/community features, health-report parsing, chat history, advanced settings, large analytics dashboards, gamification, background cloud jobs, and iOS Live Activities are intentionally excluded from this two-day scope.

## Architecture

```text
Expo Router screens
       │
feature hooks/controllers ── design-system primitives
       │
domain functions + Zod contracts
       │
local SQLite repositories ── pending sync coordinator
       │                              │
provider boundaries              Fastify REST API
  ├─ ActivityProvider                ├─ Drizzle/PostgreSQL
  ├─ LiveActivityProvider            ├─ Sarvam speech-to-text
  └─ meal API client                 └─ Bedrock Mantle models
       │
Expo native module (Kotlin)
  ├─ Health Connect + step-counter sensor
  └─ foreground health service
       ├─ root-level React Native activity island
       ├─ Android 16 ProgressStyle Live Update
       ├─ opt-in pre-16 compact/expanded cross-app activity island
       └─ standard ongoing notification
```

This is an npm-workspace monorepo:

```text
apps/
  mobile/                 Expo/React Native app and local Expo module
  api/                    Fastify API, providers, Drizzle schema/migrations
packages/
  contracts/              Shared Zod request/response/domain contracts
  domain/                 Framework-free calculations and unit tests
```

Mobile code is feature-first under `apps/mobile/src/features`. A component stays with its feature until another feature genuinely needs it. Cross-feature storage, API, error, and bootstrap code lives under `shared`; OS-specific integration lives under `native` and `modules`.

## Design system

Screens consume semantic theme values rather than palette names or scattered constants. The token set covers light/dark semantic colours, spacing, radii, typography, shadows, touch sizing, and motion timing/springs. Reusable primitives own pressed, disabled, loading, accessibility, icon-spacing, and progress behaviour.

Motion uses Reanimated and follows reduced-motion settings. It is limited to useful feedback: progress fill, listening pulse, scan state, and result/metric transitions. Haptics mark capture, confirmation, activity start, milestones, and goal completion.

## AI boundaries

`FoodAnalysisProvider` separates application code from providers:

- text food analysis: Z.AI GLM 5 through Amazon Bedrock Mantle;
- image food analysis: Moonshot Kimi K2.5 through Amazon Bedrock Mantle;
- transcription: Sarvam `saaras:v4`;
- deterministic mock provider: route-test and development fallback only.

Every model response follows `raw response → JSON parse → Zod validation → normalized domain object → UI`. Invalid or low-confidence output is visible and recoverable; it is never silently accepted.

## Activity and Android Live Update

React Native depends only on these boundaries:

```ts
interface ActivityProvider {
  getTodaySteps(): Promise<number>;
  subscribeToSteps(callback: (steps: number) => void): () => void;
}

interface LiveActivityProvider {
  isSupported(): Promise<boolean>;
  start(input: LiveActivityStartInput): Promise<void>;
  update(input: LiveActivityUpdateInput): Promise<void>;
  end(): Promise<void>;
}
```

The local Expo module aggregates today's Health Connect `StepsRecord` data, then uses the low-power Android step-counter sensor for activity updates. In the foreground, a root-level React Native component owns the compact/expanded interaction, gestures, haptics, navigation, metrics, and end confirmation. A non-exported foreground health service owns only the system continuation: Android 16/API 36 devices with promoted notifications enabled receive `NotificationCompat.ProgressStyle`; earlier devices can opt into a non-focusable `TYPE_APPLICATION_OVERLAY` island that expands on tap or swipe, shows live metrics, opens Kimbo, and provides a two-step end confirmation. The standard ongoing notification remains the fallback. Foreground/background ownership is coordinated so both islands never appear together. Overlay permission is requested contextually when starting an activity; no Accessibility Service is used. Ending the activity removes both the overlay and notification.

Android minimum SDK is 26 because stable Health Connect client 1.1 requires it. Compile/target SDK is 36.

## Error, permission, and offline behaviour

- API errors are typed and mapped centrally to user language.
- Requests have timeouts and all responses are schema-validated.
- Camera, microphone, activity, Health Connect, notifications, and optional display-over-apps access are requested only at the relevant action.
- Permission denial always preserves another path (manual meal, gallery, or calorie tracking without steps).
- Corrupt local records are discarded safely instead of crashing startup.
- Confirmed meals and completed sessions remain local with `pending` state until sync succeeds.
- The active session and its notification are reconstructed when the app reopens.

## Local setup

Requirements: Node.js 22+, npm, PostgreSQL, Android Studio/SDK 36, and JDK 17.

```powershell
npm install
Copy-Item .env.example .env
Copy-Item apps/mobile/.env.example apps/mobile/.env.local
```

Fill the real provider values in `.env`. Secrets are read only by the backend and must never use an `EXPO_PUBLIC_` prefix.

For a physical phone, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` to the computer's reachable LAN address, for example `http://192.168.1.5:3000`, and allow port 3000 through the local firewall. The emulator default is `http://10.0.2.2:3000`.

Create the PostgreSQL database and apply migrations:

```powershell
createdb -h 127.0.0.1 -U postgres kimbo
npm run db:migrate --workspace @kimbo/api
```

Run the services in separate terminals:

```powershell
npm run dev:api
npm run dev:mobile
```

The custom native module means activity features require a development/native build; they do not run in Expo Go.

## Build an Android APK

```powershell
Set-Location apps/mobile
npx expo prebuild --platform android --clean --no-install
Set-Location android
.\gradlew.bat assembleDebug
```

The debug APK is written to `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. A distributable release additionally requires an Android signing keystore and release signing configuration; no secret signing material is committed.

## Quality commands

```powershell
npm run typecheck
npm test
npm run lint --workspace @kimbo/mobile
Set-Location apps/mobile; npx expo-doctor
```

Domain tests cover health-target estimation, meal totals, daily progress, and empty/partial/full weekly progress. API route tests verify contract validation and repository/provider boundaries. Physical-device acceptance should cover Health Connect grants/denials, step sensor updates, Android 16 promotion eligibility, standard notification fallback, camera/audio capture, process restart, and offline recovery.

## Third-party visual attribution

The Today insight prototype uses [Mood interaction by ardraawork](https://rive.app/marketplace/27639-52202-mood-interaction/) from the Rive Marketplace under the CC BY license. The `.riv` file remains an attributed third-party asset and is not represented as original Kimbo artwork.

## Known limitations

- Health Connect and the promoted notification must be validated on a compatible physical Android device; emulators cannot prove real sensor behaviour.
- Android decides whether an eligible promoted notification is surfaced as a Live Update. On pre-Android 16 devices, the optional activity island requires user-granted display-over-apps special access and may be positioned differently by an OEM.
- Background sensor collection is intentionally not implemented; Health Connect remains the source of truth across app restarts.
- Pending sync retries on app foreground. A production release would add durable background retry with backoff and observability.
- There is no production authentication in this assignment, so anonymous device IDs are not a security boundary.
- The debug APK is intentionally universal and therefore large. Play/App Bundle release builds split architectures and run shrinking.

## What comes next

After physical-device acceptance: add authenticated account recovery, background sync with idempotency keys, server-generated daily summaries, production telemetry with redaction, end-to-end mobile tests, release signing/Play internal testing, and only then consider more health sources or health-report ingestion.
