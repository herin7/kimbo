export type PermissionType = "microphone" | "camera" | "photos" | "activity" | "notifications";

export type AppError =
  | { type: "NETWORK_ERROR" }
  | { type: "OFFLINE" }
  | { type: "AI_UNAVAILABLE" }
  | { type: "INVALID_AI_RESPONSE" }
  | { type: "PERMISSION_DENIED"; permission: PermissionType }
  | { type: "CAMERA_ERROR" }
  | { type: "VALIDATION_ERROR"; message: string }
  | { type: "AUTH_ERROR" }
  | { type: "STORAGE_ERROR" }
  | { type: "UNKNOWN_ERROR" };

export function mapAppErrorToMessage(error: AppError): string {
  switch (error.type) {
    case "NETWORK_ERROR":
      return "Kimbo couldn't reach the server. Check your connection and try again.";
    case "OFFLINE":
      return "You're offline. Your changes will stay on this device until you reconnect.";
    case "AI_UNAVAILABLE":
      return "Meal analysis is temporarily unavailable. You can still enter the meal manually.";
    case "INVALID_AI_RESPONSE":
      return "Kimbo couldn't confidently analyse that meal. Try again or enter it manually.";
    case "PERMISSION_DENIED":
      return `${error.permission} access is off. You can choose another way to continue.`;
    case "CAMERA_ERROR":
      return "The camera couldn't start. Choose a photo or describe the meal instead.";
    case "VALIDATION_ERROR":
      return error.message;
    case "AUTH_ERROR":
      return "That email or password didn't match. Try a demo account below.";
    case "STORAGE_ERROR":
      return "Kimbo couldn't save that on this device. Please try again.";
    case "UNKNOWN_ERROR":
      return "Something unexpected happened. Please try again.";
  }
}
