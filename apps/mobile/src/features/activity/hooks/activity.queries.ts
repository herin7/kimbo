import type { ActivitySession } from "@kimbo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { activityProvider } from "../providers/activity-provider";
import { activityRepository } from "../storage/activity.repository";

export const todayStepsQueryKey = ["activity", "today-steps"] as const;
export const activeSessionQueryKey = ["activity", "active-session"] as const;
export const activitySessionsQueryKey = ["activity", "sessions"] as const;

export function useTodaySteps(subscribe = false) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: todayStepsQueryKey, queryFn: () => activityProvider.getTodaySteps(), staleTime: 15_000 });
  useEffect(() => {
    if (!subscribe) return;
    return activityProvider.subscribeToSteps((steps) => queryClient.setQueryData(todayStepsQueryKey, steps));
  }, [queryClient, subscribe]);
  return query;
}

export function useActiveSession() {
  return useQuery({ queryKey: activeSessionQueryKey, queryFn: () => activityRepository.getActiveSession() });
}

export function useActivitySessions() {
  return useQuery({ queryKey: activitySessionsQueryKey, queryFn: () => activityRepository.getSessions() });
}

export function useSaveActivitySession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (session: ActivitySession) => activityRepository.saveSession(session),
    onSuccess: async (_, session) => {
      queryClient.setQueryData(activeSessionQueryKey, session.state === "active" ? session : null);
      await queryClient.invalidateQueries({ queryKey: activitySessionsQueryKey });
    },
  });
}
