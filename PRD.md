# pile — Technical Spec & ERD (v0.1)

> 로그인 없이 과제물·링크·교재를 던져놓는 온라인 보드. 빨래 더미(pile) 은유 기반.

---

## 1) 목표 및 범위

* **목표**: 오프라인/온라인 강의 중 참가자들이 로그인 없이 자료(텍스트/파일/링크)를 빠르게 공유·수집할 수 있는 보드 제공
* **범위**: 보드/채널/아이템(텍스트·파일·링크), 익명 사용자, 관리자 모드(삭제), 실시간 갱신(SSE), 단일 서버 배포(Next.js + SQLite)
* **비범위(초기 미포함)**: 계정 시스템, 권한 세분화, 외부 스토리지, 모바일 앱, WYSIWYG 편집

---

## 2) 아키텍처 개요

* **런타임**: Next.js (App Router, Route Handlers), Node 20+, TypeScript
* **DB**: SQLite (파일 경로: `./data/pile.db`)
* **ORM**: Drizzle ORM (SQLite) — 마이그레이션 관리 포함
* **실시간**: Server-Sent Events(SSE) — 단일 서버 가정, 보드 단위 채널 스트림
* **파일 저장**: 로컬 디스크 `./data/uploads/<YYYY/MM>/<uuid>.<ext>`
* **메타태그 수집**: 서버 사이드 fetch + OpenGraph/`<title>` 파싱
* **세션/식별**: 쿠키 기반 익명 id(`anon_id`) 발급, 랜덤 닉네임 저장; 관리자 모드 플래그 쿠키(`is_admin`)
* **배포**: Docker (bind mount `./data`), 단일 컨테이너
* **보안**: 업로드 크기 제한, MIME 화이트리스트, 간단한 레이트 리밋, 관리자 비밀번호는 환경변수

---

## 3) 도메인 모델

* **Board**: 강의 과정 단위 워크스페이스 (`/:boardId`)
* **Channel**: Board 하위 분류 (`/:boardId/:channelId`) — 목적별(과제, 링크, 교안 등)
* **Item**: 사용자 업로드 엔트리(텍스트/파일/링크) — 채널에 종속
* **AnonUser**: 로그인 없이 식별하기 위한 익명 사용자 엔티티(선택 이름/닉네임)

---

## 4) ERD (Mermaid)

```mermaid
erDiagram
    Board ||--o{ Channel : has
    Channel ||--o{ Item : contains
    Board ||--o{ BoardMember : has
    AnonUser ||--o{ Item : created

    Board {
      string id PK
      string name
      string slug UNIQUE
      string description
      string default_channel_id FK
      integer session_block_minutes  // 차시 길이(분), ex) 60
      string session_anchor          // HH:mm, ex) "00:00" or "00:30"
      datetime created_at
      datetime updated_at
    }

    Channel {
      string id PK
      string board_id FK
      string name              // 예: 공유, 과제제출, 교안
      string slug              // URL id, 기본 생성시 "default"
      integer order_index
      datetime created_at
      datetime updated_at
    }

    Item {
      string id PK
      string channel_id FK
      string board_id FK
      string anon_user_id FK
      string type             // "text" | "file" | "link"
      string text_md          // type=text 시 내용 (Markdown)
      string file_path        // type=file 시 상대경로
      string file_mime
      integer file_size
      string link_url         // type=link 시 원본 URL
      string link_title
      string link_desc
      string link_image
      datetime created_at
      datetime updated_at
      datetime session_start  // 차시 시작 시각(보드 설정 기반 도출/저장)
    }

    AnonUser {
      string id PK            // 랜덤 uuid
      string nickname         // ex) "푸른고래-83"
      string display_name     // 사용자가 입력한 이름(선택)
      datetime created_at
      datetime last_seen_at
    }

    BoardMember {
      string board_id FK
      string anon_user_id FK
      datetime joined_at
      PRIMARY KEY (board_id, anon_user_id)
    }
```

---

## 5) 데이터 규칙

* **세션(차시) 계산**

  * 기준: `Board.session_anchor`(HH\:mm) + `session_block_minutes`(기본 60)
  * 아이템 생성 시 서버가 `session_start`를 계산 후 저장 (예: 18:30\~19:30 블록 → `session_start=18:30`)
* **채널 기본값**

  * 보드 생성 시 `Channel{ slug="default", name="공유" }` 자동 생성 & `Board.default_channel_id`에 연결
* **익명 사용자**

  * 최초 접근 시 `anon_id` 쿠키 발급, DB에 `AnonUser` upsert
  * 닉네임은 서버에서 `색상+동물-난수` 형태 생성

---

## 6) API 설계 (App Router Route Handlers)

* **형식**: JSON, `application/json`; 업로드는 `multipart/form-data`
* **Auth**: 없음(일반), 관리자 모드는 쿠키 `is_admin=true` 필요

### 6.1 보드

* `GET /api/boards` — 보드 목록
* `POST /api/boards` — \[admin] 보드 생성 `{ name, slug?, description?, session_block_minutes?, session_anchor? }`
* `GET /api/boards/:boardId` — 보드 상세 + 기본 채널 id
* `PATCH /api/boards/:boardId` — \[admin] 보드 설정 수정

### 6.2 채널

* `GET /api/boards/:boardId/channels` — 채널 목록
* `POST /api/boards/:boardId/channels` — \[admin] 채널 생성 `{ name, slug? }`
* `GET /api/boards/:boardId/channels/:channelId` — 채널 상세
* `PATCH /api/boards/:boardId/channels/:channelId` — \[admin]

### 6.3 아이템

* `GET /api/boards/:boardId/items?channelId=&since=` — 목록(최신순, pagination 키 `since` 지원)
* `POST /api/boards/:boardId/items` — 아이템 생성 (본문 중 하나 필수)

  * `type=text`: `{ type, channelId?, text }`
  * `type=link`: `{ type, channelId?, url }` (서버가 메타태그 수집)
  * `type=file`: `multipart/form-data` (fields: `type=file`, `channelId?`, `file`)
* `DELETE /api/items/:itemId` — \[admin] 아이템 삭제

### 6.4 유저/세션

* `POST /api/anon/identify` — 쿠키 없을 시 식별(닉네임·uuid 발급)
* `POST /api/admin/login` — 본문: `{ password }` → 검증 후 `is_admin=true` 쿠키 세팅, 이름은 env `ADMIN_NAME` 고정
* `POST /api/admin/logout` — 관리자 쿠키 제거

### 6.5 실시간(SSE)

* `GET /api/boards/:boardId/stream` — 보드 스트림 (headers: `text/event-stream`)

  * 이벤트 타입: `item.created`, `item.deleted`, `channel.created`, `board.updated`
  * 생성/삭제 시 서버가 해당 보드 스트림에 브로드캐스트

---

## 7) 업로드 스펙

* **제스처**: Ctrl+V, Drag\&Drop만 지원 (텍스트 붙여넣기/파일 드롭/URL 붙여넣기)
* **제한**: 기본 20 MB/file, 허용 MIME(이미지, PDF, Office 일부, ZIP)
* **저장**: `./data/uploads/YYYY/MM/uuid.ext`
* **이름표시**: 원본 파일명은 DB `Item` 메타에 추가 가능(옵션 `file_original_name`)

---

## 8) 화면/라우트 구조

* `/` — 보드 목록(카드형) + \[관리자 버튼]
* `/admin` — 비밀번호 입력 → 성공 시 쿠키 세팅, 헤더에 관리자명 표시
* `/:boardId` — 보드 뷰

  * 상단: 보드 정보, 채널 탭(#아이콘), 업로드 힌트(붙여넣기/드롭)
  * 리스트: 카드형(텍스트 렌더: Markdown), 파일 썸네일/다운로드, 링크 프리뷰(OG)
  * 세션(차시) 구분 헤더: `YYYY-MM-DD HH:mm` 블록 단위 그룹핑
  * 실시간 반영: SSE 구독
* `/:boardId/:channelId` — 채널 필터링 뷰

---

## 9) 관리자 모드

* **활성화**: `/admin`에서 패스워드 확인 → `is_admin=true` 쿠키
* **권한**: 아이템 삭제 버튼 활성화, 보드·채널 생성/수정 가능
* **이름**: 표시명은 `ADMIN_NAME` 환경변수 고정

---

## 10) 환경변수 (.env)

* `ADMIN_NAME` — 관리자 표시명
* `ADMIN_PASSWORD` — 관리자 로그인 비밀번호
* `MAX_UPLOAD_MB` — 기본 20
* `NODE_ENV` — production/development
* `PORT` — 서버 포트

---

## 11) Next.js 디렉터리 스캐폴드(예시)

* `app/`

  * `page.tsx` — 보드 목록
  * `[boardId]/page.tsx`
  * `[boardId]/[channelId]/page.tsx`
  * `admin/page.tsx`
  * `api/boards/route.ts`
  * `api/boards/[boardId]/route.ts`
  * `api/boards/[boardId]/channels/route.ts`
  * `api/boards/[boardId]/channels/[channelId]/route.ts`
  * `api/boards/[boardId]/items/route.ts`
  * `api/items/[itemId]/route.ts`
  * `api/anon/identify/route.ts`
  * `api/admin/login/route.ts`
  * `api/admin/logout/route.ts`
  * `api/boards/[boardId]/stream/route.ts` (SSE)
* `lib/db.ts` — Drizzle + SQLite 연결
* `lib/og.ts` — 링크 메타 파서
* `lib/sse.ts` — 보드별 EventEmitter 맵
* `components/` — UI(아이템 카드, 업로드 영역, 채널탭 등)
* `drizzle/` — schema, migrations
* `data/` — `pile.db`, `uploads/`

---

## 12) Drizzle 스키마 (요지)

```ts
// drizzle/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const boards = sqliteTable('boards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  defaultChannelId: text('default_channel_id'),
  sessionBlockMinutes: integer('session_block_minutes').notNull().default(60),
  sessionAnchor: text('session_anchor').notNull().default('00:00'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

export const anonUsers = sqliteTable('anon_users', {
  id: text('id').primaryKey(),
  nickname: text('nickname').notNull(),
  displayName: text('display_name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull(),
  boardId: text('board_id').notNull(),
  anonUserId: text('anon_user_id'),
  type: text('type').notNull(),
  textMd: text('text_md'),
  filePath: text('file_path'),
  fileMime: text('file_mime'),
  fileSize: integer('file_size'),
  linkUrl: text('link_url'),
  linkTitle: text('link_title'),
  linkDesc: text('link_desc'),
  linkImage: text('link_image'),
  sessionStart: integer('session_start', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

export const boardMembers = sqliteTable('board_members', {
  boardId: text('board_id').notNull(),
  anonUserId: text('anon_user_id').notNull(),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().defaultNow(),
}, (t) => ({ pk: { columns: [t.boardId, t.anonUserId], isPrimaryKey: true } }));
```

---

## 13) SSE 브로드캐스트 전략

* **보드별 EventEmitter**를 `lib/sse.ts`에 보관(Map: `boardId -> Set<Response>`)
* **생성/삭제 시** 해당 보드 구독자에게 이벤트 전송(JSON 직렬화)
* **헬스비트**: 20초 간격 `:keepalive` 주석/빈 이벤트 송출
* **에러/종료 처리**: 연결 끊김 감지 시 Set에서 제거

---

## 14) 업로드 파이프라인

* **파일형**: `multer` 또는 Web API `formData()` 파서 사용 → 크기 제한·MIME 체크 → 저장 → DB 인서트 → SSE 발사
* **텍스트형**: 붙여넣기 텍스트 → `type=text`, Markdown 그대로 저장
* **링크형**: URL 붙여넣기 → 서버가 fetch → OG 파싱(제목/설명/이미지) → DB 저장 → SSE

---

## 15) 권한 모델

* **익명**: 아이템 생성만 가능
* **관리자**: 보드/채널 생성·수정, 아이템 삭제 가능
* **판단 근거**: 관리자 쿠키(`is_admin=true`) + 서버에서 서명된 값 검증(HMAC)

---

## 16) 보안·안전장치

* **업로드 제한**: `MAX_UPLOAD_MB` 환경변수, MIME 화이트리스트
* **경로 안전**: 파일 저장 시 경로 정규화, 확장자 화이트리스트
* **XSS 방지**: Markdown 렌더링 시 sanitize(링크 rel, 이미지 속성 제한)
* **CSRF**: 단일 오리진, 비-폼 API는 `sameSite=lax` 쿠키 + `POST` 사용, 필요시 CSRF 토큰 추가 가능
* **레이스**: 단일 DB 트랜잭션, 인덱스 적용(slug unique)
* **레이트 리밋**: IP/anon\_id 별 분당 생성 제한(예: 30 req/min)

---

## 17) 인덱스/성능

* `Board.slug` UNIQUE, `Channel.board_id+slug` 복합 UNIQUE 권장
* `Item.board_id`, `Item.channel_id`, `Item.created_at DESC` 인덱스
* `Item.session_start` 인덱스(세션 그룹 조회 최적화)

---

## 18) 마이그레이션(초안, SQLite)

```sql
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  default_channel_id TEXT,
  session_block_minutes INTEGER NOT NULL DEFAULT 60,
  session_anchor TEXT NOT NULL DEFAULT '00:00',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(board_id, slug)
);

CREATE TABLE anon_users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  anon_user_id TEXT,
  type TEXT NOT NULL,
  text_md TEXT,
  file_path TEXT,
  file_mime TEXT,
  file_size INTEGER,
  link_url TEXT,
  link_title TEXT,
  link_desc TEXT,
  link_image TEXT,
  session_start INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE board_members (
  board_id TEXT NOT NULL,
  anon_user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (board_id, anon_user_id)
);

CREATE INDEX idx_items_board ON items(board_id);
CREATE INDEX idx_items_channel ON items(channel_id);
CREATE INDEX idx_items_created ON items(created_at DESC);
CREATE INDEX idx_items_session ON items(session_start);
```

---

## 19) UX 세부 사항

* **업로드 힌트**: 빈 보드/채널에서는 중앙에 큰 드롭존 + “Ctrl+V 또는 파일 드롭” 카피
* **단축키**: `Ctrl+V` 텍스트/URL/파일 모두 허용(클립보드 판별)
* **채널 UI**: 해시(`#`) 아이콘 + 이름, 드래그로 순서 변경(관리자)
* **세션 헤더**: “2025-09-18 18:30 \~ 19:30” 같이 시각 표시

---

## 20) 테스트 시나리오(요약)

* **아이템 생성**: text/link/file 각각 성공/실패(MIME, 용량 초과)
* **세션 계산**: `00:00`/`00:30` 앵커, 60/90분 블록 케이스
* **SSE 갱신**: 다중 탭에서 동시 업데이트 수신
* **관리자**: 로그인/로그아웃, 아이템 삭제, 채널 생성
* **보안**: XSS 렌더링 방지, 경로 우회 방지, 레이트 리밋 동작

---

## 21) Docker & 실행

* **Dockerfile(요지)**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build
VOLUME ["/app/data"]
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
```

* **docker-compose.yml(예시)**

```yaml
services:
  pile:
    build: .
    ports: ["3000:3000"]
    environment:
      - ADMIN_NAME=${ADMIN_NAME}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - MAX_UPLOAD_MB=20
    volumes:
      - ./data:/app/data
```

---

## 22) 초기 시드/플로우

* **보드 생성**: 관리자 로그인 → 보드 생성(name/slug) → 기본 채널 자동 생성
* **참여자 접근**: URL 공유(`/slug`) → 첫 방문 시 `anon_id` 발급 → 닉네임 노출
* **수집**: 참가자는 붙여넣기/드롭으로 아이템 생성 → 화면은 SSE로 갱신

---

## 23) 향후 확장 포인트

* **QR 코드 보드 진입**(강의실용), **Zip 내보내기**, **태그/검색**, **만료 정책(수거일)**
* **S3/Cloudflare R2 업로드**, **오프라인 PWA 캐시**, **여러 관리자 지원**, **역할 기반 권한**

---

## 24) 작업 체크리스트(스프린트 0)

* Drizzle 스키마/마이그레이션 생성
* 보드 생성/조회 API
* 채널 기본 생성 로직
* 아이템 업로드 3종(text/link/file)
* 세션 계산 유틸
* SSE 스트림/브로드캐스터
* 기본 UI(보드/채널/아이템 카드, 드롭존)
* 관리자 로그인/삭제
* Dockerfile & compose, `./data` 마운트

