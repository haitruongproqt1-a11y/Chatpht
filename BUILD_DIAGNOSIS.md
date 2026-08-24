# Chẩn đoán build Android — 2026-08-25

## Kết luận dùng cho APK cài độc lập

React Native Gradle Plugin coi biến thể `debug` là debuggable theo mặc định. Các biến thể debuggable không mang JavaScript bundle, nên cần Metro hoạt động để chạy. Vì vậy APK `assembleDebug` được tải trực tiếp từ GitHub có thể dừng ở splash khi không có Metro.

APK thử nghiệm cài độc lập phải dùng biến thể `release`, vốn đóng gói JavaScript bundle. Expo prebuild mặc định ký `release` bằng debug keystore trong cấu hình Android hiện tại, do đó không cần secrets ký nhưng không phù hợp phát hành sản xuất.

## Nguồn

- React Native Gradle Plugin: https://reactnative.dev/docs/react-native-gradle-plugin
- Expo local app development: https://docs.expo.dev/guides/local-app-development/
- Expo Notifications SDK 54: https://docs.expo.dev/versions/latest/sdk/notifications/
