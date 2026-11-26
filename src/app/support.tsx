import { LegalPage } from '@/components/legal-page';
import { SUPPORT_MAIL, supportMailUrl } from '@/lib/support-mail';

// 문의 (명세 4-24). 앱스토어 지원 주소
export default function SupportScreen() {
  return (
    <LegalPage
      title="문의하기"
      sections={[
        { title: '메일', lines: [], link: { label: SUPPORT_MAIL, href: supportMailUrl() } },
        {
          title: '자주 묻는 것',
          lines: [],
          qa: [
            { q: '친구는 어떻게 들어와요?', a: '모임 화면의 QR이나 링크를 보내면, 앱이 없어도 이름만 적고 들어와요.' },
            { q: '다른 폰에서도 쓰고 싶어요.', a: '내 프로필 > 다른 기기에서 이어 쓰기에서 아이디를 만들어요.' },
            { q: '계정을 지우고 싶어요.', a: '내 프로필 > 계정 삭제에서 바로 지워져요.' },
          ],
        },
      ]}
    />
  );
}
