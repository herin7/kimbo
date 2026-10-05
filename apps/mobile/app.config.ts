import type { ConfigContext, ExpoConfig } from "expo/config";
import { withGradleProperties } from "expo/config-plugins";

// kimbo-mood.riv drives moods with state machine triggers. @rive-app/react-native's default
// ("experimental") Android backend throws on triggerInput, so Kimbo stayed on his idle face.
const withRiveLegacyBackend = (config: ExpoConfig) =>
  withGradleProperties(config, (gradle) => {
    gradle.modResults = gradle.modResults.filter((item) => item.type !== "property" || item.key !== "USE_RIVE_LEGACY");
    gradle.modResults.push({ type: "property", key: "USE_RIVE_LEGACY", value: "true" });
    return gradle;
  });

export default ({ config }: ConfigContext): ExpoConfig => {
  const resolved = config as ExpoConfig;
  return withRiveLegacyBackend({
    ...resolved,
    android: {
      ...resolved.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    },
  });
};
