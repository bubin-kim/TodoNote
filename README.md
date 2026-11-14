# TodoNote

macOS용 떠 있는 줄 노트 체크리스트 위젯 (Electron).

## 기능
- 항상 위에 떠 있는 메모지, 체크하면 취소선 + 완료 항목 자동 정렬(아래/위/제자리)
- 드래그로 순서 변경, 더블클릭으로 수정
- 마감일 지정 + 마감일순 정렬
- 집중 타이머: 헤더의 작은 타이머 + 펼치는 원형 시계 패널(시간 끌어서 설정, 프리셋 편집)
- 색상 20가지 + 직접 고르기, 투명도 조절
- 접기(헤더만 남기기), 상하좌우 크기 조절
- 모든 설정과 데이터는 자동 저장

## 실행
```
npm install
npm start
```

## 앱으로 빌드 (macOS)
```
npm run package   # dist/TodoNote-darwin-<arch>/TodoNote.app
```
빌드한 `TodoNote.app`을 `~/Applications`에 옮기면 터미널 없이 실행할 수 있습니다.

## 저장 위치
`~/Library/Application Support/todo-note/` (`todos.json`, `window.json`)

## 구조
- `main.js` 창 생성, 저장/불러오기, 접기·크기 조절
- `preload.js` 렌더러와 메인 사이의 브리지
- `index.html` `style.css` `renderer.js` UI
- `build/icon.icns` 앱 아이콘
