import { readdirSync, readFileSync } from "node:fs";
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
    const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260722063500_enforce_free_test_credentials/migration.sql"), "utf8");
    const hashes = [...migration.matchAll(/\$2b\$12\$[./A-Za-z0-9]{53}/g)].map(([value]) => value);
    const uniqueHashes = [...new Set(hashes)];
    expect(uniqueHashes).toHaveLength(2);
    expect(await compare("admin", uniqueHashes[0]!)).toBe(true);
    expect(await compare("agent01", uniqueHashes[1]!)).toBe(true);
    expect(migration).toContain('"tokenVersion" = "tokenVersion" + 1');
    expect(migration).not.toContain('"passwordHash" <>');
  });

  it("시드가 몇 번 실행돼도 기존 직원 비밀번호를 갱신할 수 없다", () => {
    const seedSource = readFileSync(resolve(process.cwd(), "prisma/seed.ts"), "utf8");
    expect(seedSource).not.toContain("SEED_RESET_EXISTING_PASSWORDS");
    expect(seedSource.match(/prisma\.agent\.upsert\(\{[^\n]*update: \{\}/g)).toHaveLength(2);
    expect(seedSource).not.toContain("data: { passwordHash");
  });

  it("Docker와 Render 설정에서 과거 강제 재설정 환경변수를 다시 전달하지 않는다", () => {
    const repositoryRoot = resolve(process.cwd(), "../..");
    const deploymentConfig = [".env.example", "compose.yaml", "render.yaml"]
      .map((file) => readFileSync(resolve(repositoryRoot, file), "utf8"))
      .join("\n");
    expect(deploymentConfig).not.toContain("SEED_RESET_EXISTING_PASSWORDS");
    expect(deploymentConfig).not.toContain("FORCE_FREE_TEST_CREDENTIALS");
  });

  it("과거 세 복구 마이그레이션 외에 직원 비밀번호를 변경하는 데이터 마이그레이션을 금지한다", () => {
    const migrationRoot = resolve(process.cwd(), "prisma/migrations");
    const credentialMigrations = readdirSync(migrationRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => {
        const sql = readFileSync(resolve(migrationRoot, entry.name, "migration.sql"), "utf8");
        return /UPDATE\s+"Agent"[\s\S]*?SET\s+"passwordHash"/m.test(sql);
      })
      .map((entry) => entry.name)
      .sort();
    expect(credentialMigrations).toEqual([
      "20260722022000_reset_free_test_credentials",
      "20260722062000_repair_free_test_credentials",
      "20260722063500_enforce_free_test_credentials",
    ]);
  });
});
