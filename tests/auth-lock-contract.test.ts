import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const rootLayout = readFileSync(resolve(process.cwd(), "app/_layout.tsx"), "utf8");
const loginScreen = readFileSync(resolve(process.cwd(), "app/login.tsx"), "utf8");
const authStore = readFileSync(resolve(process.cwd(), "lib/_core/auth.ts"), "utf8");
const appLockGate = readFileSync(resolve(process.cwd(), "components/app-lock-gate.tsx"), "utf8");
const appLockSettings = readFileSync(resolve(process.cwd(), "app/app-lock.tsx"), "utf8");

describe("local authentication and app-lock contract", () => {
  it("keeps a local token on web and native so protected calls use the same session", () => {
    expect(authStore).toContain("getWebStorage()?.setItem(SESSION_TOKEN_KEY, token)");
    expect(authStore).toContain("SecureStore.setItemAsync(SESSION_TOKEN_KEY, token)");
    expect(rootLayout).toContain("if (!isAuthenticated && !isLoginRoute) return <Redirect href=\"/login\" />");
    expect(rootLayout).toContain("if (isAuthenticated && isLoginRoute) return <Redirect href=\"/(tabs)\" />");
  });

  it("completes session persistence before navigating away from login or registration", () => {
    expect(loginScreen).toContain("await completeSignIn(result.token, result.user)");
    expect(loginScreen).toContain('router.replace("/(tabs)" as any)');
    expect(loginScreen).toContain("setFormError(error instanceof Error ? error.message");
    expect(loginScreen).toContain("accessibilityRole=\"alert\"");
  });

  it("shows the local app lock only for a new authenticated launch, not background activity", () => {
    expect(rootLayout).toContain("<AppLockGate>");
    expect(appLockGate).toContain("initialSessionRef.current");
    expect(appLockGate).toContain("Khóa chỉ được hỏi khi bạn đóng hẳn rồi mở lại ứng dụng");
    expect(appLockSettings).toContain("Bật khóa ứng dụng");
    expect(appLockSettings).toContain("Gỡ khóa ứng dụng");
  });

  it("does not leave the Android startup gate loading when SecureStore cannot read the PIN", () => {
    expect(appLockGate).toContain("try {");
    expect(appLockGate).toContain("Không thể đọc khóa ứng dụng khi khởi động");
    expect(appLockGate).toContain("finally {");
    expect(appLockGate).toContain("if (active) setChecking(false);");
  });

  it("requires the account password before resetting a forgotten app PIN", () => {
    expect(appLockGate).toContain("Quên mã PIN?");
    expect(appLockGate).toContain("trpc.auth.login.useMutation");
    expect(appLockGate).toContain("Mật khẩu tài khoản chưa đúng");
    expect(appLockGate).toContain("Xác minh và đặt lại");
    expect(appLockGate).toContain("await setAppLockPin(newPin)");
  });
});
