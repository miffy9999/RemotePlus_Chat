import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compare } from "bcrypt";
import { validate } from "class-validator";
import { CreateAgentDto } from "../src/modules/admin/dto/create-agent.dto";
import { LoginDto } from "../src/modules/auth/dto/login.dto";

describe("무료 테스트 비밀번호 정책", () => {
  it("로그인 비밀번호의 길이와 문자 조합을 제한하지 않는다", async () => {
    const dto = Object.assign(new LoginDto(), { loginId: "admin", password: "a" });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("새 Agent 비밀번호의 길이와 문자 조합을 제한하지 않는다", async () => {
    const dto = Object.assign(new CreateAgentDto(), { name: "테스트", loginId: "agent02", password: "x", role: "AGENT" });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("배포 마이그레이션의 bcrypt 해시가 지정한 두 테스트 비밀번호와 일치한다", async () => {
    const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260722062000_repair_free_test_credentials/migration.sql"), "utf8");
    const hashes = [...migration.matchAll(/\$2b\$12\$[./A-Za-z0-9]{53}/g)].map(([value]) => value);
    const uniqueHashes = [...new Set(hashes)];
    expect(uniqueHashes).toHaveLength(2);
    expect(await compare("admin", uniqueHashes[0]!)).toBe(true);
    expect(await compare("agent01", uniqueHashes[1]!)).toBe(true);
    expect(migration).toContain('"tokenVersion" = "tokenVersion" + 1');
  });
});
