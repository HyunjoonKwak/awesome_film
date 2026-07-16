# cut_editor

[English](README.md) · **한국어**

웹용 오픈소스 AI 기반 협업 비디오 에디터 — Final Cut Pro의 완성도와 CapCut의
접근성을 모두 잡되, 두 도구 어디에도 없는 협업·로컬 AI 기능까지 함께 제공합니다.

> [OpenCut](https://github.com/OpenCut-app/OpenCut) 학습에서 출발했습니다
> (오프라인 참고용으로 `reference/`에 클론, 빌드에 포함되지 않음).

## 왜 또 하나의 에디터인가?

| | Final Cut Pro | CapCut | OpenCut | **cut_editor** |
|--|:--:|:--:|:--:|:--:|
| 오픈소스 | ❌ | ❌ | ✅ | ✅ |
| 전체 기능 무료 | ❌ | 일부 | ✅ | ✅ |
| 브라우저 네이티브 | ❌ | ❌ | ✅ | ✅ |
| AI: 자막 + 장면 + 묵음 | 일부 | ✅ | 일부 | ✅ |
| 로컬 AI (Whisper, MediaPipe) | ❌ | ❌ | 일부 | ✅ |
| 실시간 협업 편집 | ❌ | 일부 | ❌ | ✅ |
| 플러그인 SDK | ✅ | ❌ | ❌ | ✅ |
| 마그네틱 타임라인 + 리플 | ✅ | ❌ | 일부 | ✅ |
| 모바일 우선 제스처 | n/a | ✅ | ❌ | ✅ |
| 로컬 우선 영속화 | 일부 | ❌ | 일부 | ✅ |

전체 매트릭스는 [`docs/01-feature-matrix.md`](docs/01-feature-matrix.md),
기술 설계는 [`docs/02-architecture.md`](docs/02-architecture.md), 플러그인
SDK는 [`docs/03-plugin-sdk.md`](docs/03-plugin-sdk.md)를 참고하세요.

## 현재 동작하는 기능

| 레이어 | 기능 |
|--|--|
| 코어 모델 | 불변 Project / Track / Clip / Effect / Keyframe / Transition + 실행취소·다시실행 |
| 타임라인 | 멀티트랙, 마그네틱 스냅, 리플, 트림/분할/이동, 트랙 간 드래그, 핀치 줌 |
| 렌더러 | WebGL2 컴포지터, ping-pong FBO, 다중 패스 이펙트 체인, 키프레임 보간 |
| 이펙트 | 밝기, 가우시안 블러, 비네트, 배경 제거 — 모두 GLSL ES 3.0 프래그먼트 패스 |
| 텍스트 | Canvas2D 렌더 텍스트 클립(크기/색/배경 조절) + 전용 자막 트랙 |
| 미디어 | OPFS 기반 자산, 썸네일/파형 분석, 드래그-드롭 입수 |
| AI (전부 로컬) | 자동 묵음 컷(WebAudio RMS), Whisper 자막(HuggingFace), 장면 감지(χ²), 배경 제거(MediaPipe Selfie) |
| 내보내기 | WebCodecs H.264/VP9/AV1 + AAC 오디오 믹서, 4종 프리셋 (YouTube 1080p/4K, TikTok 9:16, Web VP9) |
| 영속화 | Yjs CRDT + IndexedDB — 새로고침·브라우저 재시작에도 유지 |
| 협업 | y-websocket 룸 코드 입장/퇴장, 상단 바에 awareness 표시 |
| 플러그인 SDK | `window.cutEditor.registerEffect` + `registerShader`, `localStorage["cut.plugins"]`로 URL 로드 |
| 모바일 | 반응형 셸 + 드로어 패널 + 투핑거 핀치 줌 |

## 저장소 구조

```
apps/web/         Next.js 15 앱 (에디터 UI)
apps/desktop/     Electron 셸 (macOS .app/.dmg 패키징)
packages/core/    프레임워크 독립 엔진 (데이터 모델, 스케줄러, 렌더러)
docs/             설계 문서 + 플러그인 SDK
reference/        학습용 OpenCut 클론 (gitignored)
```

## 빠른 시작

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

실시간 협업은 릴레이 서버를 설정하기 전까지 비활성화됩니다.
`apps/web/.env.example`을 `apps/web/.env.local`로 복사하고
`NEXT_PUBLIC_COLLAB_WS_URL`에 자체 y-websocket 주소를 설정하세요. 원격 서버는
`wss://`가 필수이며 로컬 개발에서는 `ws://localhost:1234`를 사용할 수 있습니다.
데스크톱 릴리스 빌드는 GitHub Actions 저장소 변수 `COLLAB_WS_URL`에서 같은
주소를 읽습니다.

요구사항: Node 20+, pnpm 9+.

### 브라우저 E2E 테스트

```bash
pnpm --filter @cut/web exec playwright install chromium  # 최초 1회
pnpm test:e2e
```

테스트는 격리된 로컬 에디터 서버를 실행해 화면 진입, 새로고침 후 IndexedDB
프로젝트 복원, 협업 설정 오류 안내를 검증합니다.

## macOS 앱으로 설치하기

cut_editor는 PWA manifest + 서비스 워커를 동봉하므로 별도 도구 없이 독립
데스크톱 윈도우로 설치할 수 있습니다.

**Safari (macOS 권장)**

1. 실행 중인 사이트(예: `https://your-host/editor`)를 Safari 17+에서 엽니다.
2. **파일 → Dock에 추가…**
3. 이름과 아이콘을 확인하고 추가를 클릭합니다.

브라우저 크롬 없는 독립 윈도우로 실행되며 별도 dock 항목을 가집니다. 동봉된
서비스 워커가 앱 셸을 캐시해 짧은 네트워크 단절에도 계속 편집할 수 있습니다.

**Chrome / Edge**

주소창의 설치 아이콘(⊕)을 클릭하거나 **파일 → 설치**를 선택해 Launchpad와
dock에 앱을 추가합니다.

메뉴·파일 다이얼로그·자동 업데이트를 갖춘 완전한 네이티브 `.app` 번들이
필요하면 [`apps/desktop/`](apps/desktop/)을 참고하세요.

### 동봉된 로컬 AI 모델

MediaPipe(배경 제거) wasm 런타임과 Selfie Segmenter 모델은
`apps/web/public/mediapipe/`에 포함되어 있어 배경 제거 기능은 완전 오프라인
동작합니다.

Whisper 자막 모델(~40 MB, `Xenova/whisper-tiny.en` q8 양자화)은 첫 사용 시
HuggingFace에서 다운로드되며, 이후 브라우저 HTTP 캐시에 보관됩니다. 첫 실행
시점부터 오프라인으로 동작시키려면(데스크톱 번들 등) 아래 스크립트를
실행하세요:

```bash
pnpm --filter @cut/web prebundle:whisper
```

스크립트가 `apps/web/public/whisper/Xenova/whisper-tiny.en/`에 모델 파일 7개
(약 41 MB)를 채웁니다. 런타임이 `env.localModelPath`로 해당 경로를 먼저
확인하고, 파일이 없을 때만 HuggingFace로 폴백합니다. 해당 디렉토리는
gitignore되어 있으므로 새로운 체크아웃마다 또는 데스크톱 빌드 파이프라인 안에서
재실행하세요.

## 릴리스 빌드

릴리스 빌드는 매 push가 아니라 수동 트리거로만 동작합니다. 워크플로 정의는
[`.github/workflows/release.yml`](.github/workflows/release.yml)에 있습니다.

**태그 릴리스 (권장)**

```bash
# 1. apps/desktop/package.json 의 version 을 올립니다 (예: 0.1.0 → 0.1.1).
#    이어서 push 할 태그와 같은 숫자여야 합니다.

# 2. 버전 변경을 커밋.
git commit -am "chore: bump desktop to 0.1.1"
git push

# 3. 태그 push — 이 시점에 워크플로가 발화합니다.
git tag v0.1.1
git push --tags
```

약 15분 후 동일 이름의 GitHub Release 에 `.dmg` 두 개(`-arm64` / Intel)와
`latest-mac.yml` 이 함께 업로드됩니다(자동 업데이터가 같은 경로를 봅니다).

**임시 빌드** — GitHub 리포지토리 → **Actions** → **Release** → **Run
workflow** 버튼. 현재 `apps/desktop/package.json` 의 version 값을 그대로
사용합니다.

`.dmg` 는 기본 미사이닝 상태로 생성됩니다(`electron-builder.yml` 의
`identity: null`). GitHub Release 에서 다운로드한 `.app` 은 macOS 가
`com.apple.quarantine` 속성을 자동으로 붙여 **"…손상되었기 때문에 열 수
없습니다"** 라는 거짓 메시지를 띄웁니다 — 우클릭 → 열기로도 우회되지
않습니다. 첫 실행 전에 속성을 제거해야 합니다:

```bash
xattr -cr /Applications/cut_editor.app
```

별도 안내 없이 바로 열리는 사이닝 + 공증된 `.dmg` 를 만들려면 Apple
Developer Secret 5개 (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`)를 리포지토리 Secrets 에
추가하고 `identity: null` 줄을 제거하면 됩니다 — 워크플로 변경 불필요.

## 로드맵 (v0.1 이후)

- WebGPU 렌더러 (wgsl 셰이더, 플러그인 SDK v2)
- 클립별 트랜스폼(이동/회전/스케일) + 키프레임 UI
- 마스크 그리기 도구 + 트래킹
- Tauri 네이티브 데스크톱 래퍼
- Capacitor 모바일 네이티브 셸
- 플러그인 마켓플레이스 + 샌드박스 iframe

### 보류 항목 (평가 완료, 미출시)

- **컴파운드/네스티드 시퀀스**. 클립 묶음을 재사용 가능한 서브-타임라인으로
  감싸는 기능. 재귀 렌더링(내부 시퀀스를 오프스크린 FBO로 렌더 후 부모
  클립의 소스로 샘플)과 `kind: "compound"` 신규 추가, 직렬화·실행취소·협업
  처리가 필요. MVP(재생+편집)에 2~3일, 키프레임 전파 완전 지원까지는 더
  소요 예상.
- **백그라운드 렌더 큐**. 내보내기 파이프라인을 별도 Electron
  `BrowserWindow`/`utilityProcess`로 분리해 렌더 중에도 편집 가능하게
  만드는 기능. 현재 파이프라인은 메인 렌더러에서 동작(WebCodecs도 거기
  있음). 분리하려면 공유 OPFS 레이어와 IPC 인코더 브릿지가 필요 — 데스크톱
  번들 한정 2일 예상, 웹과 동등 기능까지 가려면 더 소요.
