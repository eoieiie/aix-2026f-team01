import { QUIZ, AXES } from "@/constants/quiz";

import {
  isValidHandle,
  ProfileError,
  profileErrorMessage,
  saveMyProfile,
  typeCode,
  typeLines,
} from "./profile";

// 서버 save_my_profile과 같은 점수 계산: A=+1, B=-1, 축마다 두 문항 평균(정수 나눗셈)
function scoreLikeServer(answers: ("A" | "B")[]) {
  const s = answers.map((x) => (x === "A" ? 1 : -1));
  const avg = (i: number) => Math.trunc((s[i] + s[i + 1]) / 2);
  return { explore: avg(0), spicy: avg(2), korean: avg(4), lead: avg(6) };
}

describe("typeCode (spec.md 4-14, 5절 축 점수)", () => {
  it("전부 A면 탐매한주, 전부 B면 반순외수", () => {
    expect(typeCode(scoreLikeServer(Array(8).fill("A")))).toBe("탐매한주");
    expect(typeCode(scoreLikeServer(Array(8).fill("B")))).toBe("반순외수");
  });
  it("0이면 앞 글자", () => {
    expect(typeCode({ explore: 0, spicy: 0, korean: -1, lead: 0 })).toBe(
      "탐매외주",
    );
  });
  it("축이 없으면 null", () => {
    expect(typeCode(null)).toBeNull();
    expect(typeCode({ explore: 1 })).toBeNull();
  });
  it("축마다 한 줄 설명", () => {
    expect(
      typeLines({ explore: 1, spicy: -1, korean: 1, lead: -1 })
        .map((x) => x.letter)
        .join(""),
    ).toBe("탐순한수");
  });
});

describe("문항 (spec.md 4-14)", () => {
  it("8문항, 축 4개", () => {
    expect(QUIZ).toHaveLength(8);
    expect(AXES.map((a) => a.key)).toEqual([
      "explore",
      "spicy",
      "korean",
      "lead",
    ]);
  });
});

describe("아이디 모양", () => {
  it("영어 소문자, 숫자, 밑줄 3~16자", () => {
    expect(isValidHandle("bap_bti1")).toBe(true);
    expect(isValidHandle("ab")).toBe(false);
    expect(isValidHandle("Bap")).toBe(false);
    expect(isValidHandle("a".repeat(17))).toBe(false);
  });
});

describe("saveMyProfile", () => {
  it("넘기지 않은 칸은 null로 보내고, 서버 오류 코드는 한국어 문구로 바꾼다", async () => {
    const rpc = jest.fn(async () => ({
      data: null,
      error: { message: "handle_taken" },
    }));
    const err = await saveMyProfile({ handle: "taken" }, { rpc } as any).catch(
      (e) => e,
    );
    expect(rpc).toHaveBeenCalledWith("save_my_profile", {
      p_display_name: null,
      p_handle: "taken",
      p_quiz_answers: null,
    });
    expect(err).toBeInstanceOf(ProfileError);
    expect(profileErrorMessage(err)).toBe("이미 쓰는 아이디예요");
  });
  it('서버 코드가 아니면 "연결할 수 없어요"', () => {
    expect(profileErrorMessage(new Error("Failed to fetch"))).toBe(
      "연결할 수 없어요",
    );
  });
});
