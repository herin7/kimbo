import { View } from "react-native";

import { useKimboTheme } from "../../theme";
import { Button } from "../Button";
import { Card } from "../Card";
import { Text } from "../Text";

interface PermissionFallbackProps {
  title: string;
  description: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  secondaryLabel: string;
  onSecondaryPress: () => void;
}

export function PermissionFallback({ title, description, primaryLabel, onPrimaryPress, secondaryLabel, onSecondaryPress }: PermissionFallbackProps) {
  const { spacing } = useKimboTheme();
  return (
    <Card variant="outlined">
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">{title}</Text>
          <Text color="secondary">{description}</Text>
        </View>
        <Button onPress={onPrimaryPress}>{primaryLabel}</Button>
        <Button onPress={onSecondaryPress} variant="ghost">{secondaryLabel}</Button>
      </View>
    </Card>
  );
}
