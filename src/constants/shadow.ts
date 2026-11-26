import colors from '@/constants/colors.json';

// 떠 있는 아래 탭 알약의 그림자 (docs/design.md "떠 있는 아래 탭과 박스, 글자 정돈", 2026-11-26).
// 흰 바탕 위의 흰 알약이라 묻히지 않게 조금 또렷하게 둔다. 카드에는 그림자를 쓰지 않는다(회색 면으로 나눈다).
// 웹은 box-shadow, iOS는 shadow*, 안드로이드는 elevation으로 그려진다
export const FLOAT_SHADOW = {
  shadowColor: colors.ink,
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;
