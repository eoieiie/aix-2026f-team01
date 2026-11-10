import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

type TextFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  // 글자 수 상한은 src/constants에서 가져와 넘긴다. 예: GROUP_NAME_MAX, DISPLAY_NAME_MAX
  maxLength: number;
  label?: string;
  placeholder?: string;
  // 있으면 입력칸 아래에 빨간 글씨로 보인다. 서버 오류 문구도 여기에 넣는다 (4-2)
  error?: string | null;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  // 글자 수 표시. 검색칸처럼 길이가 중요하지 않으면 끈다. 켜도 상한의 80%를 넘을 때만 보인다
  showCount?: boolean;
  // 비밀번호 칸이면 글자를 가린다
  secure?: boolean;
  // 아이디처럼 대문자가 들어가면 안 되는 칸
  autoCapitalize?: 'none' | 'sentences';
};

// 글자 수는 서버(Postgres char_length)와 같은 방식으로 센다. 한글 한 자도, 이모지 한 개도 1자
export function countChars(text: string) {
  return Array.from(text).length;
}

// 상한의 80%부터 글자 수를 보인다. 그 전에는 숫자가 할 일이 없다 (docs/design.md 4절 "빼기")
export function nearLimit(text: string, maxLength: number) {
  return countChars(text) >= Math.ceil(maxLength * 0.8);
}

// 화면 공통 입력칸 (이슈 #10). 글자 수 표시와 오류 문구 자리가 있다
export function TextField({
  value,
  onChangeText,
  maxLength,
  label,
  placeholder,
  error,
  autoFocus,
  onSubmitEditing,
  showCount = true,
  secure = false,
  autoCapitalize,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const count = showCount && nearLimit(value, maxLength);

  return (
    <View className="gap-1">
      {label ? <Text className="text-sm font-semibold text-text">{label}</Text> : null}
      <TextInput
        accessibilityLabel={label ?? placeholder}
        value={value}
        onChangeText={(text) => onChangeText(Array.from(text).slice(0, maxLength).join(''))}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCapitalize === 'none' ? false : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // 쓰는 중인 칸은 검정 선 하나로 보인다. 평소 선은 바탕과 같은 색이라 보이지 않는다
        className={`h-14 rounded-2xl border-2 bg-surface px-5 text-lg text-text placeholder:text-muted ${
          focused ? 'border-ink' : 'border-surface'
        }`}
      />
      {count || error ? (
        <View className="flex-row justify-between gap-2">
          <Text className="flex-1 text-sm text-danger">{error ?? ''}</Text>
          {count ? (
            <Text className="text-sm text-muted">
              {countChars(value)}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
