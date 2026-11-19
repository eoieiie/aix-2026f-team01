import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

// 입력칸이 있는 화면과 창을 감싼다. 아이폰에서는 키보드가 올라오면 아래 버튼까지 같이 올라간다.
// 웹과 안드로이드는 창 크기가 스스로 줄어서 아무것도 하지 않는다 (2026-11-19, 테스트플라이트에서 키보드가 "다음" 버튼을 가림)
export function KeyboardSafe({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
