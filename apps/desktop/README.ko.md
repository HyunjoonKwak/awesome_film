# @cut/desktop

[English](README.md) · **한국어**

cut_editor 웹 앱을 네이티브 macOS 애플리케이션으로 패키징하는 Electron
셸입니다. Next.js 정적 export(`apps/web`)를 커스텀 `app://` 프로토콜로
서빙해 서비스 워커 등록과 SharedArrayBuffer(COOP/COEP)가 데스크톱
윈도우 내부에서도 정상 동작합니다.

## 아키텍처

```
electron main (src/main.cjs)
 ├─ app:// 프로토콜 핸들러   → apps/web/out/** 을 COOP/COEP 헤더와 함께 서빙
 ├─ session 헤더 주입       → 개발 시 http://localhost 응답에도 동일 헤더 추가
 ├─ BrowserWindow           → `app://cut-editor/editor/` 로드
 └─ 네이티브 메뉴           → File/Edit/View 명령을 preload 통해 전달
```

preload(`src/preload.cjs`)는 네이티브 메뉴 클릭 IPC를
`window.dispatchEvent(new CustomEvent("cut:menu-export"))` 등으로 변환해
웹 앱이 메뉴 동작에 반응할 수 있도록 합니다.

## 개발 워크플로

```bash
pnpm --filter @cut/desktop install      # 최초 1회
pnpm --filter @cut/desktop dev          # next dev + electron 동시 실행
```

`dev`는 `pnpm --filter @cut/web dev`를 띄우고 `http://localhost:3000/editor`가
응답하면 Electron 윈도우가 해당 주소를 로드합니다. DevTools는 분리된 창으로
열립니다.

## `.dmg` 패키징

```bash
pnpm --filter @cut/desktop build:mac          # universal (arm64 + x64)
pnpm --filter @cut/desktop build:mac:arm64    # Apple silicon 전용
pnpm --filter @cut/desktop build:mac:x64      # Intel 전용
```

스크립트 동작:

1. `apps/web/`에서 `NEXT_OUTPUT=export next build` 실행 → `apps/web/out/`에
   정적 HTML/JS/미디어 산출.
2. `electron-builder --mac`으로 `.app` 번들 생성 후 `.dmg`로 래핑. 결과물은
   `apps/desktop/dist/`에 저장.

웹 export에는 `apps/web/public/mediapipe/`에 동봉된 MediaPipe wasm + tflite가
포함되어 배경 제거 기능이 오프라인 동작합니다. Whisper 자막 모델을 첫 실행
시점부터 오프라인으로 동작시키려면 루트 README 안내에 따라 모델을
`apps/web/public/whisper/Xenova/whisper-tiny.en/` 경로에 사전 배치한 뒤
패키징하세요.

## 코드 사이닝 + 공증

`electron-builder.yml`에 Hardened Runtime이 활성화되어 있습니다. 사이닝과
공증을 진행하려면 빌드 전에 아래 환경변수를 설정하세요:

```bash
export CSC_LINK=/path/to/DeveloperID.p12
export CSC_KEY_PASSWORD='...'
export APPLE_ID='you@example.com'
export APPLE_APP_SPECIFIC_PASSWORD='abcd-efgh-ijkl-mnop'
export APPLE_TEAM_ID='ABCDE12345'
pnpm --filter @cut/desktop build:mac
```

electron-builder가 자동으로 이 변수들을 읽어 사이닝하고 결과 `.dmg`에
`notarytool` 공증을 적용합니다. 변수 없이 빌드하면 미사이닝 번들이 생성되며
macOS Gatekeeper가 차단합니다(로컬 테스트는 가능, 배포 부적합).

## 다음 단계

- `electron-updater` + GitHub Releases를 통한 자동 업데이트(현재 미사이닝
  빌드도 `build:mac` 통과 — 업데이터 추가는 별도 후속 작업).
- 내보내기 대상 경로용 네이티브 파일 다이얼로그(현재는 브라우저 다운로드
  플로우 사용).
- Mac App Store용 별도 universal 빌드 (electron-builder 타겟 추가).
