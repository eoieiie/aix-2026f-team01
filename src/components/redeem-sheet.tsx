import { useState } from 'react';
import { View } from 'react-native';

import { couponErrorText } from '@/hooks/use-shops';
import { Button } from '@/components/button';
import { Sheet } from '@/components/sheets';
import { Text, TextInput } from '@/components/text';
import { STAFF_PIN_LENGTH } from '@/constants';
import { type Coupon, useRedeemCoupon } from '@/hooks/use-shops';

// 직원 확인 창 (4-27). 가게 직원이 누르면 쿠폰이 쓴 것으로 남고 다시 못 쓴다.
// 가게에 비밀번호가 있으면 숫자 네 자리를 넣어야 한다. 없으면 확인 한 번
export function RedeemSheet({ coupon, visible, onClose }: { coupon: Coupon; visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {visible ? <RedeemBody coupon={coupon} onClose={onClose} /> : null}
    </Sheet>
  );
}

function RedeemBody({ coupon, onClose }: { coupon: Coupon; onClose: () => void }) {
  const redeem = useRedeemCoupon();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const ready = !coupon.pinRequired || pin.length === STAFF_PIN_LENGTH;

  const submit = () => {
    if (!ready || redeem.isPending) return;
    setMessage(null);
    redeem.mutate(
      { couponId: coupon.id, pin: coupon.pinRequired ? pin : null },
      {
        onSuccess: (res) => {
          if (res.ok) {
            onClose();
            return;
          }
          setPin('');
          setMessage(
            res.reason === 'locked'
              ? '여러 번 틀려서 이 쿠폰은 잠겼어요'
              : `비밀번호가 달라요. ${res.triesLeft}번 더 넣을 수 있어요`
          );
        },
        onError: (e) => setMessage(couponErrorText(e)),
      }
    );
  };

  return (
    <>
      <View className="gap-2">
        <Text className="text-xl font-bold tracking-tight text-text">직원 확인</Text>
        <Text className="text-base text-muted">
          {coupon.pinRequired ? '가게 직원이 비밀번호를 넣어 주세요' : '가게 직원이 눌러 주세요'}
        </Text>
      </View>
      <View className="gap-1 rounded-2xl bg-surface p-4">
        <Text className="text-sm text-muted">{coupon.shopName}</Text>
        <Text className="text-lg font-semibold text-text">{coupon.benefit}</Text>
      </View>
      {coupon.pinRequired ? (
        <TextInput
          accessibilityLabel="가게 비밀번호 네 자리"
          value={pin}
          onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, STAFF_PIN_LENGTH))}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={STAFF_PIN_LENGTH}
          secureTextEntry
          autoFocus
          placeholder="숫자 네 자리"
          onSubmitEditing={submit}
          className="h-14 rounded-lg bg-surface px-4 text-center text-2xl font-bold tracking-widest text-text placeholder:text-muted"
        />
      ) : null}
      {message ? <Text className="text-sm text-danger">{message}</Text> : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label="취소" variant="secondary" onPress={onClose} />
        </View>
        <View className="flex-1">
          <Button label="사용 처리" onPress={submit} disabled={!ready} loading={redeem.isPending} />
        </View>
      </View>
    </>
  );
}
