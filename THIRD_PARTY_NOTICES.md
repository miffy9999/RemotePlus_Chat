# 제3자 오픈소스 고지

마지막 점검: 2026-07-21

이 프로젝트는 자체 코드에 MIT 라이선스를 사용하며, 아래 오픈소스 소프트웨어를 포함하거나 빌드·운영에 사용한다. 현재 `pnpm-lock.yaml`을 `pnpm licenses list --prod --json`으로 검사한 결과 GPL, AGPL, LGPL, SSPL 계열은 발견되지 않았다.

## 직접 사용하는 주요 패키지

| 패키지 | 확인 버전 | 라이선스 |
|---|---:|---|
| React / React DOM | 19.2.7 | MIT |
| React Router DOM | 7.18.1 | MIT |
| NestJS packages | 11.1.28 | MIT |
| Socket.IO / Socket.IO Client | 4.8.3 | MIT |
| Prisma Client / Prisma | 6.19.3 | Apache-2.0 |
| RxJS | 7.8.2 | Apache-2.0 |
| bcrypt | 6.0.0 | MIT |
| class-transformer | 0.5.1 | MIT |
| class-validator | 0.14.4 | MIT |
| Helmet | 8.3.0 | MIT |
| jsonwebtoken | 9.0.3 | MIT |
| dotenv | 16.6.1 | BSD-2-Clause |

## 전체 잠금 파일의 라이선스 분포

| 라이선스 | 패키지 항목 수 |
|---|---:|
| MIT | 213 |
| Apache-2.0 | 13 |
| ISC | 10 |
| BSD-3-Clause | 6 |
| BSD-2-Clause | 2 |
| 0BSD | 1 |
| CC-BY-4.0 | 1 |

`caniuse-lite` 데이터는 CC-BY-4.0으로 제공된다. 출처는 [Browserslist/caniuse-lite](https://github.com/browserslist/caniuse-lite)이며 라이선스 조건은 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)에서 확인할 수 있다. 빌드 과정에서 사용된 데이터이며 해당 출처가 이 제품을 보증한다는 의미는 아니다.

각 패키지의 정확한 저작권자, 버전별 라이선스 전문과 `NOTICE` 파일은 설치된 패키지 또는 해당 원본 저장소를 기준으로 한다. 배포 직전에는 다음 명령을 다시 실행하고, 잠금 파일이 바뀌었다면 이 문서와 배포 산출물의 라이선스·NOTICE 묶음을 갱신해야 한다.

```bash
pnpm licenses:list
```

참고 라이선스 전문:

- [MIT License](https://opensource.org/license/mit)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
