import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase 클라이언트는 이 파일에서만 만든다. 화면은 src/hooks의 훅을 거쳐서만 쓴다 (spec.md 3절 2번)

let client: SupabaseClient | null = null;

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`${name}이(가) 비어 있다. .env.example을 보고 .env를 채운다`);
    this.name = 'MissingEnvError';
  }
}

// 처음 부를 때 만든다. 환경변수가 없어도 앱이 import 단계에서 죽지 않고, 로그인 실패 화면으로 간다
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new MissingEnvError('EXPO_PUBLIC_SUPABASE_URL');
  if (!anonKey) throw new MissingEnvError('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  client = createClient(url, anonKey, {
    auth: {
      // 웹은 localStorage, iOS는 기기 저장소에 로그인을 남긴다. 다시 열어도 같은 익명 계정이다
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
