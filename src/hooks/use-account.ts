import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  AccountError,
  claimAccount,
  getLoginId,
  signInWithLoginId,
  signOutToAnonymous,
} from '@/api/auth';

const ACCOUNT_KEY = ['auth', 'loginId'] as const;

// 4-19 아이디로 이어 쓰기. 화면은 이 훅으로만 계정을 다룬다
export function useAccount() {
  const queryClient = useQueryClient();
  const loginId = useQuery({ queryKey: ACCOUNT_KEY, queryFn: () => getLoginId() });

  // 다른 계정으로 바뀌면 모임, 판 같은 앞 계정의 데이터를 모두 버리고 다시 불러온다
  const resetAll = () => queryClient.resetQueries();

  const claim = useMutation({
    mutationFn: ({ loginId: id, password }: { loginId: string; password: string }) =>
      claimAccount(id, password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY }),
  });
  const signIn = useMutation({
    mutationFn: ({ loginId: id, password }: { loginId: string; password: string }) =>
      signInWithLoginId(id, password),
    onSuccess: resetAll,
  });
  const signOut = useMutation({ mutationFn: () => signOutToAnonymous(), onSuccess: resetAll });

  return { loginId: loginId.data ?? null, claim, signIn, signOut };
}

// 화면 문구 (spec.md 4-19)
export function accountErrorMessage(error: unknown): string {
  const code = error instanceof AccountError ? error.code : 'network';
  switch (code) {
    case 'id_invalid':
      return '아이디는 영어 소문자, 숫자, _ 3~16자예요';
    case 'password_short':
      return '비밀번호는 6자 이상이에요';
    case 'id_taken':
      return '이미 쓰는 아이디예요';
    case 'wrong_login':
      return '아이디나 비밀번호가 달라요';
    default:
      return '연결할 수 없어요. 다시 시도해 주세요';
  }
}
