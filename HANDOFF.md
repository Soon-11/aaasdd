# v0.1final Handoff

이 문서는 `v0.1final` 기준 인수인계용입니다.

## 기준 파일

- `index.html`: 일반 사용자용 메인 페이지
- `notion.html`: 노션 임베드용 compact 페이지
- `admin.html`: 비개발자용 관리자 페이지
- `app.js`: `index.html`, `notion.html` 공용 스크립트
- `admin.js`: 관리자 전용 스크립트
- `styles.css`: 공용 스타일
- `data/inven_dataset.json`: 기본 원본 데이터
- `data/admin-backup-template.json`: 관리자 백업 템플릿

## 핵심 원칙

- `v0.1final`을 기준선으로 삼고 큰 구조 변경은 하지 말 것
- 새 기능 추가보다 기존 동작을 깨지 않게 유지하는 것을 우선할 것
- `index.html`, `notion.html`, `admin.html`은 역할이 다르므로 한 화면 기준으로 다른 화면을 망가뜨리지 말 것

## 페이지 역할

### `index.html`

- 일반 웹페이지용
- 전체 헤더, 하이라이트, 달력, 하단 일정 리스트, 모달 포함

### `notion.html`

- 노션 임베드용 compact 버전
- 상단 헤더 없음
- 하이라이트와 하단 일정 리스트는 숨김
- 날짜 클릭 시 아래로 스크롤하지 않고 모달을 바로 엶
- `원본 보기` 버튼으로 `index.html`로 이동 가능

### `admin.html`

- 비개발자도 사용할 수 있는 관리자 화면
- 게임 추가, 기본 게임 숨김, 숨김 복원, 커스텀 게임 삭제, 백업 내보내기/가져오기 가능
- 로컬 `file://` 환경에서도 떠야 함

## 특히 조심할 점

### 1. 관리자 페이지는 로컬 실행을 지원해야 함

- `admin.html`은 외부 `fetch()`만으로 동작하면 안 됨
- 현재는 `admin-base-data` JSON 스크립트를 HTML 안에 직접 내장해 둔 상태
- 이 구조를 제거하면 `file://` 환경에서 다시 깨짐

### 2. `app.js`는 공용 파일임

- `index.html`과 `notion.html`이 같이 사용함
- 한쪽에서만 필요한 수정이라고 생각해도 다른 쪽 동작을 반드시 확인해야 함

### 3. 관리자 데이터는 기본 원본 데이터와 분리되어 있음

- `data/inven_dataset.json`은 원본 데이터
- 관리자에서 추가/숨김한 변경은 `localStorage`에 저장됨
- 관리자 백업 JSON은 "변경분"만 담음
- 기본 원본 데이터 파일을 직접 수정하는 구조가 아님

### 4. 노션용 페이지를 다시 무겁게 만들지 말 것

- `notion.html`은 내부 스크롤을 줄이기 위해 줄여 둔 버전
- 상단 통계, 하단 리스트, 하이라이트를 다시 살리면 임베드 품질이 떨어짐

## localStorage 키

아래 키 이름은 유지할 것.

- `game_calendar_admin_v1`
- `game_calendar_base_cache_v1`
- `game_calendar_dataset_cache_v1`

## 현재 데이터 구조

### 기본 원본 데이터

- `data/inven_dataset.json`
- 게임/이벤트의 기본 원본

### 관리자 백업 템플릿

- `data/admin-backup-template.json`
- 형식:

```json
{
  "games": [],
  "hiddenGameIds": []
}
```

의미:

- `games`: 직접 추가한 커스텀 게임
- `hiddenGameIds`: 숨긴 기본 게임의 `game_idx`

## 수정 전에 꼭 확인할 파일

- `index.html`
- `notion.html`
- `admin.html`
- `app.js`
- `admin.js`
- `styles.css`

## 수정 후 체크리스트

1. `index.html` 정상 동작
2. `notion.html`에서 compact 레이아웃 유지
3. `admin.html`을 로컬 파일로 열어도 기본 데이터 로드됨
4. 관리자에서 게임 추가 가능
5. 관리자에서 기본 게임 숨기기/복원 가능
6. 관리자에서 커스텀 게임 삭제 가능
7. 백업 내보내기/가져오기 가능
8. 모달 열기/닫기 정상
9. YouTube iframe 임베드 정상
10. `node --check app.js` 통과
11. `node --check admin.js` 통과

## 하지 말아야 할 것

- 인코딩이 깨진 상태로 저장
- `admin.html`의 내장 기본 데이터 스크립트 제거
- `notion.html`을 일반 페이지처럼 다시 무겁게 변경
- 기본 원본 데이터와 관리자 변경 데이터를 한 파일로 합치기
- `app.js`를 수정하고 `index.html` 또는 `notion.html` 한쪽만 확인하기

## 추천 작업 방식

1. 먼저 로컬에서 확인
2. 그다음 배포 페이지 확인
3. 마지막에 노션 임베드 확인

문제가 생기면 새 기능 추가보다 원인 분리부터 할 것.
