import { Image, View } from 'react-native';

const logoSource = require('../../assets/images/logo.png');

// 공식 밥BTI 브랜드 로고 (assets/images/logo.png, 원본 비율 774:449 = 1.724)
export function Logo() {
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel="밥BTI"
      className="h-14 flex-row items-center justify-start"
    >
      <Image
        source={logoSource}
        style={{ width: 104, height: 60 }}
        resizeMode="contain"
        accessibilityLabel="밥BTI 공식 로고"
      />
    </View>
  );
}
