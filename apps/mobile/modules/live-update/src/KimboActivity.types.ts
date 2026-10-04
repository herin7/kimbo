export type KimboActivityModuleEvents = {
  onStepUpdate: (params: StepUpdateEventPayload) => void;
  onLiveActivityAction: (params: LiveActivityActionEventPayload) => void;
};

export type StepUpdateEventPayload = {
  steps: number;
};

export type LiveActivityAction = 'start' | 'end' | 'meal-voice' | 'meal-save' | 'meal-discard';

export type LiveActivityActionEventPayload = {
  action: LiveActivityAction;
  /** meal-voice: file:// URI of the recording made on the island. */
  uri?: string | null;
};

/** Meal logging shown on the island; "listening" is driven natively. */
export interface IslandMeal {
  phase: 'idle' | 'processing' | 'review' | 'saved' | 'error';
  title: string;
  detail: string;
  line?: string;
  mood?: IslandSnapshot['mood'];
}

/** Today at a glance, pushed from React Native so the island stays useful while the app is closed. */
export interface IslandSnapshot {
  mood: 'happy' | 'playful' | 'neutral' | 'sad' | 'angry';
  line: string;
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
  steps: number;
  stepTarget: number;
}

export type HealthConnectAvailability = 'available' | 'updateRequired' | 'unavailable';

export interface LiveActivityStartInput {
  type: 'walking';
  current: number;
  target: number;
  startingSteps: number;
  startedAtMillis: number;
  preferLiveUpdate: boolean;
}

export interface LiveActivityUpdateInput {
  current: number;
  target: number;
  startingSteps: number;
  startedAtMillis: number;
  preferLiveUpdate: boolean;
}
