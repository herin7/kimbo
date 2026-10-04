export interface LiveActivityStartInput {
  type: "walking";
  current: number;
  target: number;
  startingSteps: number;
  startedAtMillis: number;
}

export interface LiveActivityUpdateInput {
  current: number;
  target: number;
  startingSteps: number;
  startedAtMillis: number;
}

export interface LiveActivityProvider {
  isSupported(): Promise<boolean>;
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<void>;
  preparePresentation(): Promise<void>;
  start(input: LiveActivityStartInput): Promise<void>;
  update(input: LiveActivityUpdateInput): Promise<void>;
  end(): Promise<void>;
}
