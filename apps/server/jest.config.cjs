/** TypeScript 단위 테스트를 NestJS 소스와 같은 환경에서 실행합니다. */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: { "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  testEnvironment: "node",
};
