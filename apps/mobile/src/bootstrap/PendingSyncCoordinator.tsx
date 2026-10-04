import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { activeSessionQueryKey, activitySessionsQueryKey } from "@/features/activity/hooks/activity.queries";
import { mealsQueryKey } from "@/features/meals/hooks/meal.queries";
import { syncPendingData } from "@/shared/api/pending-sync";

export function PendingSyncCoordinator() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const synchronize = async () => {
      await syncPendingData();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: mealsQueryKey }),
        queryClient.invalidateQueries({ queryKey: activitySessionsQueryKey }),
        queryClient.invalidateQueries({ queryKey: activeSessionQueryKey }),
      ]);
    };
    void synchronize();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void synchronize();
    });
    return () => subscription.remove();
  }, [queryClient]);
  return null;
}
