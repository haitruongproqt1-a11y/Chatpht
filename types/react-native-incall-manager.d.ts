declare module "react-native-incall-manager" {
  const InCallManager: {
    start(options?: { media?: "audio" | "video"; auto?: boolean; ringback?: string; forceSpeakerphone?: boolean }): void;
    stop(options?: { busytone?: string }): void;
    setForceSpeakerphoneOn(enabled: boolean): void;
  };
  export default InCallManager;
}
