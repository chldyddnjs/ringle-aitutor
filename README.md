# 🤖 Ringle AI Tutor

LLM 기반 영어 학습 앱. AI 튜터 Alex와 음성으로 대화하고, 멤버십으로 기능을 관리합니다.

---

## 기술 스택 및 선정 배경

| 영역 | 기술 | 선정 이유 |
|---|---|---|
| Backend | Ruby on Rails 7.1 (API mode) | 과제 요구사항. ActiveRecord의 선언적 모델 설계로 멤버십/결제 비즈니스 로직을 간결하게 표현 |
| DB | PostgreSQL 16 | UUID PK, JSONB(pg_response), 복합 인덱스 지원. 멤버십 만료·결제 이력 조회 쿼리에 적합 |
| Frontend | React 18 + TypeScript + Vite 5 | 과제 요구사항. TypeScript로 API 응답 타입을 `"active" \| "expired" \| "cancelled"` 수준으로 안전하게 관리 |
| AI | GPT-4o (SSE Streaming) + Whisper-1 + TTS-1 | Mock 불가 요구사항. SSE 스트리밍으로 첫 토큰부터 즉시 렌더링해 체감 지연 시간 단축 |
| 결제 | `PaymentGatewayService` (Mock) | `charge` 메서드 1개만 교체하면 Toss/Stripe 연동 가능하도록 설계 |
| 인프라 | Docker + Docker Compose | `docker compose up --build` 한 줄로 백엔드·프론트·DB 동시 기동 |
| 테스트 | RSpec + FactoryBot / Vitest + Testing Library | Rails 생태계 표준(RSpec), React hook 테스트에 적합한 Vitest |

---

## 설계 결정 및 가정

| 항목 | 결정 | 이유 |
|---|---|---|
| **인증** | `X-User-Id` 헤더로 사용자 식별 | 요구사항 제외. `ApplicationController#set_current_user`만 JWT로 교체하면 실서비스 전환 가능 |
| **멤버십 만료** | Lazy expiry — 조회 시 `expire_outdated!` 일괄 처리 | 별도 cron 없이 간결하게 처리. 트래픽이 낮을 때도 만료가 보장됨 |
| **VAD** | `AudioContext + AnalyserNode` RMS 기반 무음 감지 | 말소리 청크만 Whisper에 전송 → STT 정확도 향상 + API 비용 절감 |
| **다시 듣기** | STT용 blob(무음 제거)과 재생용 blob(전체 녹음) 분리 | `MediaRecorder` 청크를 이어붙인 blob은 seekable 메타데이터가 없어 브라우저 재생이 깨짐 |
| **대화 세션** | 클라이언트 인메모리 (새로고침 시 초기화) | 요구사항에서 optional로 명시. API 구현 제외 |
| **rate limiting** | Rack::Attack — chat 30회/h, STT·TTS 각 60회/h, 결제 10회/h | 마이크를 열어두고 대량 요청을 보내는 오남용 패턴 방어 |
| **currency 컬럼** | KRW 고정, `price_display`는 "원" 표시 | 현재 KRW만 지원. 다국통화 확장 시 `price_display` 메서드만 수정 |

---

## 🚀 실행 방법

### 사전 요구사항

**Docker Desktop** 설치만 필요합니다.
→ https://www.docker.com/products/docker-desktop/

### 1. API 키 설정

프로젝트 루트의 `.env` 파일에 OpenAI API 키를 입력합니다:

```bash
# .env
OPENAI_API_KEY=sk-여기에_실제_키를_입력하세요
```

> `.env` 파일은 이미 포함돼 있습니다. 키 값만 교체하면 됩니다.

### 2. 프로덕션 모드 실행

```bash
docker compose up --build
```

| 서비스 | 주소 |
|---|---|
| 🌐 프론트엔드 | http://localhost |
| 🔧 백엔드 API | http://localhost:3000 |

첫 실행 시 자동으로 **DB 생성 → 마이그레이션 → 시드 데이터 입력**까지 완료됩니다.

### 3. 개발 모드 (hot reload)

```bash
docker compose -f docker-compose.dev.yml up --build
```

| 서비스 | 주소 |
|---|---|
| 🌐 프론트엔드 (Vite HMR) | http://localhost:5173 |
| 🔧 백엔드 API | http://localhost:3000 |

### 4. 시드 계정

| 계정 | 멤버십 | 사용 가능 기능 |
|---|---|---|
| `admin@ringle.com` | — (Admin) | 어드민 패널 전체 |
| `user_premium@example.com` | 프리미엄 플러스 (60일) | 학습 + **대화** + 분석 |
| `user_basic@example.com` | 베이직 (30일) | 학습만 |
| `user_none@example.com` | 없음 | — |

계정 추가:
```bash
docker compose exec backend rails db:seed
```
계정 UUID 확인:
```bash
docker compose exec backend bundle exec rails runner \
  "User.all.each { |u| puts \"#{u.email}: #{u.id}\" }"
```

---

## 🧪 테스트 실행 방법

### Backend (RSpec)

```bash
# Docker 환경
docker compose exec backend bundle exec rspec

# 특정 파일만
docker compose exec backend bundle exec rspec spec/requests/ai_spec.rb
docker compose exec backend bundle exec rspec spec/services/membership_service_spec.rb

# 로컬 환경 (Ruby 설치된 경우)
cd backend
bundle install
bundle exec rspec
```

커버리지 범위:
- `spec/models/` — User, Membership 모델 검증·스코프·메서드
- `spec/services/` — MembershipService (admin_grant, purchase, cancel)
- `spec/requests/` — 모든 API 엔드포인트 (admin/memberships, payments, ai/chat, ai/stt, ai/tts)

### Frontend (Vitest)

```bash
# Docker 환경
docker compose exec frontend npm test

# watch 모드
docker compose exec frontend npm run test -- --watch

# 로컬 환경
cd frontend
npm install
npm test
```

커버리지 범위:
- `useChat` hook — sendMessage, sendAudio(sttBlob/playBlob 분리), triggerAiGreeting, 에러 처리, TTS 실패 복구
- `MessageBubble` 컴포넌트 — 렌더링, 재생 버튼 클릭

---

## 📱 사용 흐름

### 홈 화면 (`/`)
1. 계정 선택 (시드 계정 4개 중 택 1)
2. 현재 멤버십 현황 확인 + 플랜 구매 (PG Mock)
3. `conversation` 기능이 포함된 멤버십 → "AI와 대화 시작하기" 버튼 활성화

### 대화 화면 (`/chat`)
1. 진입 시 멤버십 + `conversation` 기능 자동 체크
2. **AI(Alex)가 먼저 대화를 시작** — 인사 및 오늘의 주제 소개
3. **🎤 마이크 버튼** 클릭 → 실시간 Waveform으로 음성 인식 시각화
4. VAD가 무음 구간 실시간 감지 → 말소리 청크만 수집
5. **✅ 답변완료 버튼** → STT(Whisper) → GPT-4o 스트리밍 응답 → TTS 자동 재생
6. ▶ **다시 듣기** 버튼으로 유저/AI 발화 재청취

### Admin 패널 (`/admin`)
- 전체 사용자 목록 + 멤버십 현황
- 멤버십 강제 부여 / 취소

---

## 🛠️ 유용한 명령어

```bash
# 로그 확인
docker compose logs -f backend
docker compose logs -f frontend

# Rails 콘솔
docker compose exec backend bundle exec rails console

# DB 초기화 (전체 재시작)
docker compose down -v && docker compose up --build
```

---

## 프로젝트 구조

```
ringle-v2/
├── .env                               ← ⚠️ OPENAI_API_KEY 입력 필수
├── docker-compose.yml                 ← 프로덕션 실행
├── docker-compose.dev.yml             ← 개발 모드 (hot reload)
│
├── backend/                           ← Rails API
│   ├── app/
│   │   ├── controllers/
│   │   │   ├── admin/                 ← 멤버십 부여/취소, 사용자 관리
│   │   │   ├── ai_controller.rb       ← Chat SSE, STT(Whisper), TTS
│   │   │   ├── memberships_controller.rb
│   │   │   └── payments_controller.rb
│   │   ├── models/
│   │   └── services/
│   │       ├── membership_service.rb       ← 핵심 비즈니스 로직
│   │       └── payment_gateway_service.rb  ← PG Mock (교체 포인트)
│   ├── config/initializers/
│   │   ├── cors.rb
│   │   └── rack_attack.rb             ← Rate limiting
│   ├── db/migrate/                    ← 4개 마이그레이션
│   └── spec/                          ← RSpec 테스트
│       ├── models/
│       ├── services/
│       └── requests/
│           ├── ai_spec.rb             ← STT / TTS / Chat 엔드포인트
│           ├── payments_spec.rb
│           └── admin/memberships_spec.rb
│
└── frontend/                          ← React + TypeScript
    └── src/
        ├── api/client.ts              ← API 레이어 (SSE 포함)
        ├── hooks/
        │   ├── useVAD.ts              ← 녹음 + VAD + Waveform
        │   ├── useChat.ts             ← 채팅 상태 (SSE + STT + TTS)
        │   └── useAudioPlayer.ts
        ├── components/
        │   ├── MessageBubble.tsx
        │   ├── Waveform.tsx
        │   └── PlayButton.tsx
        ├── pages/
        │   ├── ChatPage.tsx
        │   ├── HomePage.tsx
        │   └── AdminPage.tsx
        └── __tests__/
            ├── useChat.test.ts        ← hook 단위 테스트 (15개 케이스)
            └── MessageBubble.test.tsx
```