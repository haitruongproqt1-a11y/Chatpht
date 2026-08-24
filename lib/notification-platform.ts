export function supportsNativeNotifications(platform: string): boolean {
  return platform === "android" || platform === "ios";
}
