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
};

// 글자 수는 서버(Postgres char_length)와 같은 방식으로 센다. 한글 한 자도, 이모지 한 개도 1자
export function countChars(text: string) {
  return Array.from(text).length;
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
}: TextFieldProps) {
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
        className="h-12 rounded-xl bg-surface px-4 text-base text-text"
      />
      <View className="flex-row justify-between gap-2">
        <Text className="flex-1 text-sm text-danger">{error ?? ''}</Text>
        <Text className="text-sm text-muted">
          {countChars(value)}/{maxLength}
        </Text>
      </View>
    </View>
  );
}
