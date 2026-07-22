import { afterEach, describe, expect, it, vi } from "vitest";
import { loginStaff } from "./api";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("직원 통합 로그인 API", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** 정상 배포에서는 역할 판별을 서버 요청 한 번으로 끝내 무료 Render의 인증 부하를 늘리지 않습니다. */
  it("통합 API 응답의 관리자 역할을 한 번의 요청으로 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ accessToken: "token", agent: { id: "admin-id", name: "Admin", role: "ADMIN" } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginStaff("admin", "admin")).resolves.toMatchObject({ agent: { role: "ADMIN" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/auth/login");
  });

  /** Vercel이 먼저 배포된 경우에만 404를 감지해 구버전 관리자 로그인까지 이어가 화면 중단을 피합니다. */
  it("구버전 Render와 겹치는 동안 역할별 API로 대체한다", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Cannot POST /api/auth/login" }, 404))
      .mockResolvedValueOnce(jsonResponse({ message: "로그인 정보가 올바르지 않습니다." }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "token", agent: { id: "admin-id", name: "Admin", role: "ADMIN" } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginStaff("admin", "admin")).resolves.toMatchObject({ agent: { role: "ADMIN" } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  /** 새 서버의 실제 인증 실패에는 구버전 API를 추가 호출하지 않아 잘못된 비밀번호 시도 횟수를 늘리지 않습니다. */
  it("통합 API의 인증 실패는 즉시 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "로그인 정보가 올바르지 않습니다." }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginStaff("unknown", "wrong")).rejects.toThrow("로그인 정보가 올바르지 않습니다.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
