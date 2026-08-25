/* ============================================================================
   SUMMER BREEZE — 리듬게임 (실제 플레이 가능 버전)
   ----------------------------------------------------------------------------
   19차 수정: 사용자가 직접 만든 "Pixel Pulse"(final.html) 리듬게임을 게임의
   전체적인 기반으로 이식 — 3D 복셀 노트, 기울어진 보드/중앙 허브, 카운트다운,
   콤보 배율 점수, S/A/B/C/D 랭킹을 그대로 가져왔다.

   19-1차 수정: 처음엔 Pixel Pulse 원본처럼 노래를 고를 때마다 fetch()+
   decodeAudioData()로 오디오를 받아 브라우저에서 실시간으로 온셋(비트)을
   분석했는데, 사용자가 실제로 열어보니 "오디오 로드 실패"가 떴다 — 원인은
   이 사이트가 로컬 zip을 압축 해제해서 file:// 경로로 index.html을 직접
   여는 방식으로 쓰이는데, fetch()/XMLHttpRequest는 file:// 스킴 자체를
   지원하지 않아(Chrome: "Failed to fetch") 오디오 바이트를 전혀 못 받아온
   것. Playwright로 직접 재현해 확인함 — 반면 <audio> 엘리먼트로 로컬
   파일을 로드하는 것은 file://에서도 정상 작동(13~18차가 쭉 이 방식을
   썼던 이유이기도 함). 그래서 재생/판정은 다시 <audio> 엘리먼트 +
   `currentTime` 기반(13~18차와 동일, 검증된 방식)으로 되돌리고, "실시간
   온셋 분석"은 브라우저 안에서가 아니라 **빌드 타임에 오프라인으로 한 번
   수행**하도록 바꿨다 — Pixel Pulse와 완전히 동일한 온셋 검출 알고리즘
   (에너지 기반 + 분산 임계값 + 공백 채우기 + BPM 추정 + 16분음표 그리드
   스냅)을 Node.js에서 ffmpeg로 디코딩한 PCM에 대해 그대로 돌려서 채보를
   생성했다(따라서 "자동 생성된 근사 채보"라는 원칙은 그대로 유지, 생성
   시점만 브라우저 로드 시점 → 빌드 시점으로 이동). 3D 비주얼/카운트다운/
   콤보 배율/랭킹 등 19차의 나머지 변경사항은 전부 그대로.

   PC(키보드) 전용. 4방향(위/아래/왼쪽/오른쪽) 레인에서 중앙 허브로 노트가
   모여들고, 노트가 허브에 닿는 순간 해당 방향키(W/A/S/D 또는 화살표)를
   눌러 판정을 받는다 — 방향 규칙(W=위, S=아래, A=왼쪽, D=오른쪽)은 17차/
   18차의 "식스타 게이트: 스타게이저" 스타일과 동일하게 유지했다.

   자체 DOM/CSS를 body에 주입하고, 외부에는 window.SBGame.open()/close()만
   노출한다. scrub-engine.js와 완전히 독립적 — 클래스 프리픽스는 충돌 방지를
   위해 전부 `sbg-`(SummerBreezeGame) 사용, 기존 `.sb-*`/`.sw-*`와 겹치지 않음.
============================================================================ */
(function () {
  'use strict';

  // ---------------------------------------------------------- 오프라인 채보
  // Pixel Pulse의 analyzeAudioBuffer()와 완전히 동일한 알고리즘을 Node.js에서
  // 오프라인으로 돌려서 생성한 결과(19-1차) — 브라우저에서 fetch()로 다시
  // 받아올 필요 없이 여기 정적으로 박아둔다(file:// 호환을 위해 필수).
  var BEATMAPS = /*__BEATMAPS__*/{"blue_horizon":{"bpm":185,"duration":19.81,"noteCount":38,"notes":[{"t":5.672,"lane":"a"},{"t":5.834,"lane":"s"},{"t":6.158,"lane":"w"},{"t":6.32,"lane":"w"},{"t":6.482,"lane":"s"},{"t":6.807,"lane":"s"},{"t":6.969,"lane":"a"},{"t":7.131,"lane":"a"},{"t":7.618,"lane":"s"},{"t":7.78,"lane":"a"},{"t":8.266,"lane":"w"},{"t":8.428,"lane":"s"},{"t":8.591,"lane":"a"},{"t":8.753,"lane":"s"},{"t":9.077,"lane":"d"},{"t":9.564,"lane":"w"},{"t":9.726,"lane":"w"},{"t":9.888,"lane":"a"},{"t":10.212,"lane":"s"},{"t":10.374,"lane":"w"},{"t":10.536,"lane":"s"},{"t":10.861,"lane":"s"},{"t":11.574,"lane":"w"},{"t":12.223,"lane":"s"},{"t":12.807,"lane":"a"},{"t":13.52,"lane":"d"},{"t":14.266,"lane":"s"},{"t":14.428,"lane":"s"},{"t":14.915,"lane":"w"},{"t":15.401,"lane":"a"},{"t":15.726,"lane":"a"},{"t":16.05,"lane":"d"},{"t":16.277,"lane":"a"},{"t":16.926,"lane":"a"},{"t":17.574,"lane":"s"},{"t":17.996,"lane":"w"},{"t":18.158,"lane":"a"},{"t":18.645,"lane":"w"}]},"first_wave":{"bpm":108,"duration":227.61,"noteCount":371,"notes":[{"t":0.583,"lane":"w"},{"t":0.861,"lane":"d"},{"t":1.417,"lane":"w"},{"t":1.694,"lane":"s"},{"t":1.972,"lane":"d"},{"t":3.194,"lane":"w"},{"t":3.639,"lane":"a"},{"t":3.917,"lane":"w"},{"t":4.194,"lane":"d"},{"t":4.75,"lane":"s"},{"t":5.583,"lane":"d"},{"t":5.972,"lane":"s"},{"t":6.806,"lane":"s"},{"t":8.194,"lane":"a"},{"t":8.917,"lane":"s"},{"t":9.194,"lane":"a"},{"t":9.75,"lane":"w"},{"t":10.028,"lane":"a"},{"t":10.306,"lane":"d"},{"t":10.583,"lane":"a"},{"t":11.139,"lane":"w"},{"t":11.528,"lane":"d"},{"t":12.806,"lane":"a"},{"t":13.083,"lane":"s"},{"t":13.361,"lane":"d"},{"t":13.639,"lane":"d"},{"t":14.472,"lane":"a"},{"t":14.75,"lane":"a"},{"t":15.028,"lane":"s"},{"t":15.306,"lane":"d"},{"t":15.861,"lane":"w"},{"t":16.417,"lane":"s"},{"t":16.972,"lane":"w"},{"t":17.25,"lane":"d"},{"t":17.528,"lane":"s"},{"t":18.083,"lane":"s"},{"t":18.639,"lane":"a"},{"t":19.194,"lane":"a"},{"t":19.75,"lane":"s"},{"t":20.583,"lane":"a"},{"t":21.139,"lane":"s"},{"t":21.694,"lane":"s"},{"t":22.639,"lane":"d"},{"t":23.361,"lane":"a"},{"t":23.917,"lane":"s"},{"t":24.472,"lane":"s"},{"t":25.028,"lane":"d"},{"t":25.583,"lane":"w"},{"t":26.139,"lane":"d"},{"t":26.694,"lane":"w"},{"t":27.25,"lane":"d"},{"t":27.806,"lane":"w"},{"t":28.083,"lane":"a"},{"t":28.361,"lane":"d"},{"t":28.917,"lane":"w"},{"t":29.472,"lane":"d"},{"t":30.028,"lane":"a"},{"t":30.583,"lane":"w"},{"t":31.139,"lane":"a"},{"t":31.694,"lane":"s"},{"t":32.25,"lane":"s"},{"t":32.806,"lane":"a"},{"t":33.361,"lane":"a"},{"t":33.917,"lane":"s"},{"t":34.472,"lane":"w"},{"t":35.028,"lane":"w"},{"t":35.306,"lane":"a"},{"t":35.861,"lane":"s"},{"t":36.417,"lane":"d"},{"t":36.806,"lane":"s"},{"t":38.056,"lane":"s"},{"t":38.639,"lane":"d"},{"t":39.194,"lane":"s"},{"t":39.75,"lane":"d"},{"t":40.306,"lane":"s"},{"t":40.861,"lane":"w"},{"t":41.417,"lane":"w"},{"t":41.972,"lane":"a"},{"t":42.528,"lane":"a"},{"t":43.083,"lane":"s"},{"t":43.639,"lane":"s"},{"t":44.194,"lane":"d"},{"t":44.75,"lane":"a"},{"t":45.306,"lane":"w"},{"t":45.861,"lane":"s"},{"t":46.417,"lane":"s"},{"t":46.972,"lane":"a"},{"t":47.528,"lane":"s"},{"t":48.083,"lane":"s"},{"t":48.639,"lane":"w"},{"t":49.194,"lane":"a"},{"t":49.75,"lane":"w"},{"t":50.028,"lane":"a"},{"t":51.472,"lane":"s"},{"t":52.194,"lane":"a"},{"t":53.361,"lane":"d"},{"t":53.917,"lane":"w"},{"t":54.194,"lane":"s"},{"t":54.472,"lane":"d"},{"t":55.028,"lane":"s"},{"t":55.583,"lane":"s"},{"t":56.139,"lane":"w"},{"t":56.694,"lane":"s"},{"t":57.25,"lane":"d"},{"t":57.806,"lane":"s"},{"t":58.361,"lane":"d"},{"t":58.917,"lane":"s"},{"t":59.472,"lane":"a"},{"t":60.028,"lane":"d"},{"t":60.583,"lane":"d"},{"t":61.139,"lane":"w"},{"t":61.694,"lane":"w"},{"t":62.25,"lane":"a"},{"t":62.806,"lane":"w"},{"t":63.361,"lane":"s"},{"t":63.917,"lane":"d"},{"t":64.472,"lane":"d"},{"t":65.028,"lane":"w"},{"t":65.861,"lane":"a"},{"t":66.861,"lane":"s"},{"t":67.306,"lane":"a"},{"t":67.472,"lane":"d"},{"t":68.639,"lane":"a"},{"t":69.194,"lane":"w"},{"t":69.75,"lane":"a"},{"t":70.306,"lane":"d"},{"t":70.583,"lane":"s"},{"t":70.861,"lane":"a"},{"t":71.139,"lane":"w"},{"t":71.972,"lane":"w"},{"t":72.528,"lane":"s"},{"t":73.083,"lane":"s"},{"t":73.639,"lane":"a"},{"t":74.194,"lane":"w"},{"t":74.75,"lane":"d"},{"t":75.306,"lane":"w"},{"t":75.861,"lane":"d"},{"t":76.417,"lane":"s"},{"t":76.972,"lane":"s"},{"t":77.528,"lane":"a"},{"t":78.083,"lane":"d"},{"t":78.639,"lane":"s"},{"t":79.194,"lane":"s"},{"t":79.75,"lane":"a"},{"t":80.583,"lane":"s"},{"t":81.028,"lane":"a"},{"t":82.028,"lane":"w"},{"t":82.75,"lane":"d"},{"t":83.361,"lane":"a"},{"t":83.917,"lane":"s"},{"t":84.472,"lane":"a"},{"t":85.028,"lane":"a"},{"t":85.306,"lane":"w"},{"t":85.583,"lane":"d"},{"t":86.139,"lane":"a"},{"t":86.694,"lane":"d"},{"t":87.25,"lane":"d"},{"t":87.806,"lane":"s"},{"t":88.083,"lane":"d"},{"t":88.361,"lane":"d"},{"t":88.917,"lane":"w"},{"t":89.472,"lane":"d"},{"t":89.75,"lane":"d"},{"t":90.028,"lane":"w"},{"t":90.583,"lane":"a"},{"t":91.139,"lane":"a"},{"t":91.694,"lane":"w"},{"t":92.25,"lane":"a"},{"t":92.806,"lane":"a"},{"t":93.361,"lane":"s"},{"t":93.917,"lane":"a"},{"t":94.472,"lane":"s"},{"t":95.028,"lane":"s"},{"t":95.306,"lane":"a"},{"t":96.75,"lane":"w"},{"t":97.472,"lane":"w"},{"t":98.639,"lane":"a"},{"t":99.194,"lane":"s"},{"t":99.75,"lane":"d"},{"t":100.306,"lane":"s"},{"t":100.861,"lane":"s"},{"t":101.417,"lane":"d"},{"t":101.972,"lane":"w"},{"t":102.528,"lane":"s"},{"t":103.083,"lane":"a"},{"t":103.639,"lane":"w"},{"t":104.194,"lane":"w"},{"t":104.75,"lane":"a"},{"t":105.306,"lane":"a"},{"t":105.861,"lane":"w"},{"t":106.417,"lane":"d"},{"t":106.972,"lane":"a"},{"t":107.528,"lane":"d"},{"t":108.083,"lane":"s"},{"t":108.639,"lane":"a"},{"t":108.917,"lane":"a"},{"t":109.194,"lane":"w"},{"t":109.75,"lane":"s"},{"t":110.306,"lane":"s"},{"t":111.472,"lane":"a"},{"t":112.194,"lane":"w"},{"t":113.361,"lane":"a"},{"t":113.917,"lane":"w"},{"t":114.472,"lane":"s"},{"t":115.028,"lane":"d"},{"t":115.583,"lane":"d"},{"t":116.139,"lane":"s"},{"t":116.694,"lane":"a"},{"t":117.25,"lane":"d"},{"t":117.806,"lane":"s"},{"t":118.361,"lane":"w"},{"t":118.917,"lane":"a"},{"t":119.472,"lane":"w"},{"t":120.028,"lane":"d"},{"t":120.583,"lane":"a"},{"t":121.139,"lane":"d"},{"t":121.694,"lane":"d"},{"t":122.25,"lane":"a"},{"t":122.806,"lane":"a"},{"t":123.361,"lane":"w"},{"t":123.917,"lane":"a"},{"t":124.472,"lane":"d"},{"t":125.028,"lane":"a"},{"t":125.861,"lane":"d"},{"t":126.75,"lane":"s"},{"t":128.028,"lane":"a"},{"t":128.639,"lane":"a"},{"t":129.194,"lane":"d"},{"t":129.75,"lane":"w"},{"t":130.306,"lane":"w"},{"t":130.861,"lane":"s"},{"t":131.417,"lane":"d"},{"t":131.972,"lane":"a"},{"t":132.528,"lane":"d"},{"t":133.083,"lane":"w"},{"t":133.639,"lane":"s"},{"t":134.194,"lane":"w"},{"t":134.75,"lane":"w"},{"t":135.306,"lane":"a"},{"t":135.861,"lane":"a"},{"t":136.417,"lane":"s"},{"t":136.972,"lane":"a"},{"t":137.528,"lane":"d"},{"t":138.083,"lane":"w"},{"t":138.639,"lane":"w"},{"t":139.194,"lane":"s"},{"t":139.472,"lane":"d"},{"t":139.75,"lane":"d"},{"t":140.028,"lane":"w"},{"t":140.583,"lane":"a"},{"t":141.528,"lane":"d"},{"t":142.639,"lane":"a"},{"t":143.917,"lane":"s"},{"t":144.194,"lane":"a"},{"t":144.472,"lane":"d"},{"t":145.028,"lane":"d"},{"t":145.306,"lane":"a"},{"t":145.583,"lane":"d"},{"t":146.139,"lane":"d"},{"t":146.417,"lane":"s"},{"t":146.694,"lane":"w"},{"t":147.25,"lane":"s"},{"t":147.528,"lane":"s"},{"t":147.806,"lane":"a"},{"t":148.639,"lane":"a"},{"t":148.917,"lane":"s"},{"t":149.472,"lane":"a"},{"t":149.75,"lane":"s"},{"t":150.028,"lane":"a"},{"t":150.583,"lane":"d"},{"t":150.861,"lane":"s"},{"t":151.139,"lane":"d"},{"t":151.694,"lane":"a"},{"t":151.972,"lane":"d"},{"t":152.25,"lane":"d"},{"t":152.806,"lane":"w"},{"t":153.083,"lane":"a"},{"t":153.361,"lane":"w"},{"t":153.917,"lane":"w"},{"t":154.472,"lane":"d"},{"t":154.75,"lane":"w"},{"t":155.625,"lane":"s"},{"t":156.389,"lane":"s"},{"t":157.431,"lane":"d"},{"t":157.806,"lane":"a"},{"t":158.639,"lane":"s"},{"t":158.917,"lane":"a"},{"t":159.306,"lane":"a"},{"t":160.583,"lane":"s"},{"t":161.25,"lane":"s"},{"t":162.25,"lane":"w"},{"t":162.972,"lane":"s"},{"t":163.583,"lane":"s"},{"t":164.75,"lane":"w"},{"t":166.194,"lane":"d"},{"t":166.694,"lane":"w"},{"t":167.361,"lane":"s"},{"t":168.361,"lane":"s"},{"t":169.583,"lane":"w"},{"t":171.25,"lane":"d"},{"t":172.917,"lane":"d"},{"t":173.194,"lane":"w"},{"t":174.194,"lane":"s"},{"t":174.75,"lane":"a"},{"t":175.583,"lane":"w"},{"t":175.861,"lane":"w"},{"t":176.139,"lane":"s"},{"t":176.694,"lane":"d"},{"t":177.25,"lane":"s"},{"t":177.806,"lane":"s"},{"t":178.361,"lane":"w"},{"t":178.917,"lane":"d"},{"t":179.472,"lane":"s"},{"t":180.028,"lane":"d"},{"t":180.583,"lane":"w"},{"t":181.139,"lane":"w"},{"t":181.694,"lane":"s"},{"t":182.25,"lane":"w"},{"t":182.806,"lane":"d"},{"t":183.361,"lane":"a"},{"t":183.917,"lane":"s"},{"t":184.472,"lane":"a"},{"t":184.75,"lane":"d"},{"t":185.75,"lane":"d"},{"t":186.194,"lane":"s"},{"t":187.472,"lane":"w"},{"t":188.083,"lane":"s"},{"t":188.639,"lane":"a"},{"t":189.194,"lane":"s"},{"t":189.75,"lane":"a"},{"t":190.306,"lane":"d"},{"t":190.861,"lane":"a"},{"t":191.417,"lane":"a"},{"t":191.972,"lane":"w"},{"t":192.528,"lane":"d"},{"t":193.083,"lane":"w"},{"t":193.639,"lane":"a"},{"t":193.917,"lane":"d"},{"t":194.194,"lane":"d"},{"t":194.472,"lane":"w"},{"t":195.306,"lane":"s"},{"t":195.861,"lane":"d"},{"t":196.417,"lane":"w"},{"t":196.972,"lane":"w"},{"t":197.528,"lane":"d"},{"t":198.083,"lane":"s"},{"t":198.639,"lane":"a"},{"t":199.194,"lane":"d"},{"t":199.75,"lane":"a"},{"t":200.417,"lane":"d"},{"t":200.972,"lane":"w"},{"t":202.083,"lane":"d"},{"t":203.194,"lane":"a"},{"t":203.917,"lane":"a"},{"t":204.472,"lane":"w"},{"t":205.028,"lane":"d"},{"t":205.583,"lane":"w"},{"t":206.139,"lane":"w"},{"t":206.694,"lane":"a"},{"t":207.25,"lane":"a"},{"t":207.806,"lane":"d"},{"t":208.361,"lane":"s"},{"t":208.917,"lane":"w"},{"t":209.472,"lane":"a"},{"t":210.028,"lane":"s"},{"t":210.583,"lane":"d"},{"t":211.139,"lane":"w"},{"t":211.694,"lane":"a"},{"t":211.972,"lane":"d"},{"t":212.25,"lane":"a"},{"t":212.528,"lane":"a"}]},"shining_stage":{"bpm":129,"duration":30.01,"noteCount":64,"notes":[{"t":2.326,"lane":"s"},{"t":3.023,"lane":"a"},{"t":3.488,"lane":"w"},{"t":3.721,"lane":"a"},{"t":3.953,"lane":"d"},{"t":4.419,"lane":"d"},{"t":5.116,"lane":"a"},{"t":5.581,"lane":"w"},{"t":5.814,"lane":"d"},{"t":6.279,"lane":"a"},{"t":6.744,"lane":"w"},{"t":7.209,"lane":"d"},{"t":7.442,"lane":"s"},{"t":8.14,"lane":"w"},{"t":9.07,"lane":"d"},{"t":9.302,"lane":"d"},{"t":9.767,"lane":"a"},{"t":10,"lane":"w"},{"t":10.233,"lane":"a"},{"t":10.698,"lane":"a"},{"t":11.163,"lane":"d"},{"t":11.628,"lane":"d"},{"t":12.093,"lane":"s"},{"t":12.326,"lane":"d"},{"t":12.558,"lane":"d"},{"t":13.023,"lane":"a"},{"t":13.488,"lane":"w"},{"t":13.953,"lane":"s"},{"t":14.419,"lane":"s"},{"t":14.884,"lane":"w"},{"t":15.349,"lane":"w"},{"t":15.814,"lane":"s"},{"t":16.062,"lane":"s"},{"t":16.977,"lane":"a"},{"t":17.442,"lane":"w"},{"t":17.907,"lane":"d"},{"t":18.372,"lane":"w"},{"t":18.837,"lane":"w"},{"t":19.302,"lane":"d"},{"t":19.767,"lane":"s"},{"t":20,"lane":"a"},{"t":20.233,"lane":"a"},{"t":20.698,"lane":"w"},{"t":20.93,"lane":"a"},{"t":21.163,"lane":"d"},{"t":21.628,"lane":"s"},{"t":22.093,"lane":"a"},{"t":22.558,"lane":"a"},{"t":23.023,"lane":"w"},{"t":23.488,"lane":"d"},{"t":23.721,"lane":"w"},{"t":24.651,"lane":"w"},{"t":25.116,"lane":"d"},{"t":25.581,"lane":"s"},{"t":26.047,"lane":"s"},{"t":26.512,"lane":"d"},{"t":26.977,"lane":"a"},{"t":27.442,"lane":"s"},{"t":27.907,"lane":"w"},{"t":28.372,"lane":"w"},{"t":28.605,"lane":"a"},{"t":28.837,"lane":"w"},{"t":29.302,"lane":"a"},{"t":29.767,"lane":"w"}]},"summer_breeze":{"bpm":172,"duration":30.01,"noteCount":88,"notes":[{"t":0.235,"lane":"w"},{"t":0.584,"lane":"s"},{"t":1.108,"lane":"s"},{"t":1.456,"lane":"w"},{"t":1.875,"lane":"a"},{"t":2.573,"lane":"d"},{"t":3.026,"lane":"a"},{"t":3.212,"lane":"a"},{"t":3.852,"lane":"d"},{"t":4.142,"lane":"d"},{"t":4.782,"lane":"w"},{"t":5.596,"lane":"d"},{"t":5.817,"lane":"w"},{"t":6.41,"lane":"s"},{"t":6.759,"lane":"a"},{"t":7.387,"lane":"d"},{"t":7.561,"lane":"a"},{"t":8.084,"lane":"d"},{"t":8.433,"lane":"s"},{"t":8.956,"lane":"a"},{"t":9.48,"lane":"s"},{"t":9.654,"lane":"s"},{"t":10.177,"lane":"a"},{"t":10.352,"lane":"s"},{"t":10.526,"lane":"s"},{"t":10.701,"lane":"d"},{"t":11.224,"lane":"a"},{"t":11.573,"lane":"a"},{"t":12.096,"lane":"w"},{"t":12.445,"lane":"w"},{"t":12.794,"lane":"a"},{"t":12.968,"lane":"s"},{"t":13.142,"lane":"a"},{"t":13.491,"lane":"s"},{"t":14.015,"lane":"w"},{"t":14.363,"lane":"s"},{"t":14.887,"lane":"w"},{"t":15.235,"lane":"w"},{"t":15.584,"lane":"a"},{"t":15.759,"lane":"d"},{"t":16.108,"lane":"d"},{"t":16.282,"lane":"a"},{"t":16.805,"lane":"w"},{"t":17.154,"lane":"w"},{"t":17.677,"lane":"d"},{"t":17.852,"lane":"s"},{"t":18.026,"lane":"d"},{"t":18.375,"lane":"w"},{"t":18.724,"lane":"w"},{"t":19.073,"lane":"s"},{"t":19.422,"lane":"a"},{"t":19.945,"lane":"a"},{"t":20.119,"lane":"d"},{"t":20.294,"lane":"a"},{"t":20.468,"lane":"d"},{"t":20.817,"lane":"a"},{"t":20.991,"lane":"d"},{"t":21.166,"lane":"s"},{"t":21.34,"lane":"s"},{"t":21.689,"lane":"d"},{"t":22.038,"lane":"w"},{"t":22.387,"lane":"d"},{"t":22.735,"lane":"d"},{"t":23.259,"lane":"w"},{"t":23.608,"lane":"s"},{"t":23.956,"lane":"a"},{"t":24.131,"lane":"w"},{"t":24.654,"lane":"d"},{"t":24.828,"lane":"d"},{"t":25.177,"lane":"s"},{"t":25.526,"lane":"s"},{"t":25.701,"lane":"a"},{"t":26.049,"lane":"w"},{"t":26.224,"lane":"s"},{"t":26.398,"lane":"w"},{"t":26.747,"lane":"w"},{"t":26.922,"lane":"a"},{"t":27.27,"lane":"w"},{"t":27.445,"lane":"a"},{"t":27.619,"lane":"d"},{"t":27.968,"lane":"a"},{"t":28.491,"lane":"d"},{"t":28.666,"lane":"d"},{"t":29.015,"lane":"a"},{"t":29.189,"lane":"a"},{"t":29.363,"lane":"w"},{"t":29.538,"lane":"d"},{"t":29.887,"lane":"s"}]},"summer_light":{"bpm":108,"duration":19.81,"noteCount":32,"notes":[{"t":0.285,"lane":"a"},{"t":0.84,"lane":"a"},{"t":1.118,"lane":"d"},{"t":1.951,"lane":"s"},{"t":2.507,"lane":"a"},{"t":2.785,"lane":"d"},{"t":3.062,"lane":"d"},{"t":3.618,"lane":"s"},{"t":4.451,"lane":"d"},{"t":5.007,"lane":"s"},{"t":5.285,"lane":"s"},{"t":5.562,"lane":"d"},{"t":6.118,"lane":"a"},{"t":6.674,"lane":"d"},{"t":6.951,"lane":"w"},{"t":7.507,"lane":"w"},{"t":7.785,"lane":"d"},{"t":8.062,"lane":"d"},{"t":8.618,"lane":"w"},{"t":9.174,"lane":"d"},{"t":9.451,"lane":"w"},{"t":10.007,"lane":"a"},{"t":10.563,"lane":"w"},{"t":11.118,"lane":"s"},{"t":11.951,"lane":"d"},{"t":12.229,"lane":"s"},{"t":12.507,"lane":"a"},{"t":13.063,"lane":"a"},{"t":13.618,"lane":"s"},{"t":14.451,"lane":"a"},{"t":15.007,"lane":"s"},{"t":15.563,"lane":"a"}]}}/*__END_BEATMAPS__*/;

  // ------------------------------------------------------------- song list
  var SONGS = [
    { key: 'blue_horizon',  title: 'Blue Horizon',  genre: '레트로 신스팝 / 칩튠',            cover: 'covers/blue_horizon.jpg',   file: 'audio/blue_horizon.mp3',  durLabel: '0:20', tagLabel: 'SHORT LOOP', accent: '#4FD6E0' },
    { key: 'first_wave',    title: 'First Wave',    genre: '칩튠 / 8비트 레트로 게임 팝',       cover: 'covers/first_wave.jpg',     file: 'audio/first_wave.mp3',    durLabel: '3:48', tagLabel: 'FULL TRACK', accent: '#C9A6FF' },
    { key: 'shining_stage', title: 'Shining Stage', genre: '퓨처 베이스 / 보컬 찹 일렉트로닉',  cover: 'covers/shining_stage.jpg',  file: 'audio/shining_stage.mp3', durLabel: '0:30', tagLabel: 'SHORT LOOP', accent: '#FFE9A8' },
    { key: 'summer_breeze', title: 'Summer Breeze', genre: '퓨처 바운스 / 팝 EDM',              cover: 'covers/summer_breeze.jpg',  file: 'audio/summer_breeze.mp3', durLabel: '0:30', tagLabel: 'SHORT LOOP', accent: '#FF6FA0' },
    { key: 'summer_light',  title: 'Summer Light',  genre: '퓨처 바운스 / 멜로딕 EDM',          cover: 'covers/summer_light.jpg',   file: 'audio/summer_light.mp3',  durLabel: '0:20', tagLabel: 'SHORT LOOP', accent: '#8CE99A' }
  ];

  // ------------------------------------------------ 22차: 캐릭터(멤버) 선택 + 능력
  // 곡을 고른 뒤, 로딩 전에 멤버 한 명을 골라 그 멤버의 능력을 이번 판에 적용한다.
  // 아이콘/브랜드 컬러는 랜딩 페이지의 Character 섹션(index.html의 MEMBERS 배열)과
  // 완전히 동일한 값을 재사용 — 상징 동물 아이콘(icons/*.png)과 그라디언트 컬러를
  // 그대로 가져와서 새 이미지 생성 없이 일관된 정체성을 유지했다. 각 능력은
  // 실제 멤버 역할(비주얼/래퍼/보컬/댄서/디렉터)에서 착안 — 점수 버프, 콤보 방어,
  // 판정 관대함, 미스 세이브, 노트 속도 완화로 서로 겹치지 않게 설계.
  // 22-2차: 나이/MBTI/좋아하는 것/싫어하는 것/국적/데뷔 사연은 랜딩 페이지
  // CHARACTER 섹션(index.html의 MEMBERS 배열)에 있는 것과 완전히 동일한
  // 값을 그대로 옮겨왔다 — 새 정보를 지어내지 않고 사이트 전체에서 같은
  // 프로필을 공유하도록. animal은 그 섹션의 "상징 동물" 표기용.
  // barPct(22-3차): 정보 패널의 능력 막대바 채움 비율 — 텍스트 설명은 그대로
  // 두고 "효과가 어느 정도인지" 감을 주는 장식용 게이지라, 능력 타입별로
  // 합리적인 상한을 하나씩 정해 (value - 기준치) / 상한 * 100으로 환산했다:
  // scoreMult는 +20%를 만점으로, comboShield/missSave는 5회를 만점으로,
  // windowBoost는 +50%를 만점으로, slowNotes는 +30%를 만점으로 봤다.
  var CHARACTERS = [
    { key: 'chaei',    name: '채이', role: '비주얼 · 메인래퍼', animal: '여우',        age: 23, mbti: 'ESTP', likes: '번지점프',        dislikes: '조용한 분위기, 매운 떡볶이', nation: '태국',
      debut: '유복한 환경에서 어릴 때부터 아이돌을 꿈꾸다, 한국 오디션에 합격해 데뷔.',
      icon: 'icons/fox.png',       portrait: 'portraits/chaei.png',    from: '#FF8C7A', to: '#FFE9A8',
      abilityName: '스타파워',     abilityDesc: '최종 점수 +8%',                 type: 'scoreMult',   value: 1.08, barPct: 40 },
    { key: 'dohee',    name: '도희', role: '리드래퍼',          animal: '검정 고양이', age: 21, mbti: 'ISTP', likes: '애니메이션',       dislikes: '웨이팅',                     nation: '한국',
      debut: '아르바이트를 하던 중 캐스팅되어, 짧은 연습생 기간을 거쳐 곧바로 데뷔.',
      icon: 'icons/black_cat.png', portrait: 'portraits/dohee.png',    from: '#1B2A4A', to: '#C9A6FF',
      abilityName: '플로우 실드',   abilityDesc: '미스가 나도 콤보 유지 (3회)',    type: 'comboShield', value: 3, barPct: 60 },
    { key: 'nari',     name: '나리', role: '리더 · 메인보컬',    animal: '강아지',      age: 22, mbti: 'ENFJ', likes: '나베 요리',        dislikes: '차가운 눈빛',                nation: '일본 (한일 혼혈)',
      debut: '도쿄에서 지내다 한국으로 건너와, 긴 연습생 생활 끝에 데뷔.',
      icon: 'icons/dog.png',       portrait: 'portraits/nari.png',     from: '#FFE9A8', to: '#FF8C7A',
      abilityName: '스테디 보이스', abilityDesc: '판정 윈도우 +20%',              type: 'windowBoost', value: 1.2, barPct: 40 },
    { key: 'siwol',    name: '시월', role: '예능치트키 · 서브보컬', animal: '뱁새',     age: 18, mbti: 'ESFJ', likes: '키링 · 인형 수집', dislikes: '병원',                       nation: '한국',
      debut: '고등학생 때 친구 새벽과 함께 오디션에 합격해 나란히 데뷔.',
      icon: 'icons/bapsae.png',    portrait: 'portraits/siwol.png',    from: '#4FD6E0', to: '#F5F5FF',
      abilityName: '예능 치트키',   abilityDesc: '미스 3회까지 GOOD으로 자동 전환', type: 'missSave',    value: 3, barPct: 60 },
    { key: 'saebyeok', name: '새벽', role: '퍼포먼스 디렉터',    animal: '토끼',        age: 18, mbti: 'ISFP', likes: '잠',              dislikes: '딱딱한 침대',                nation: '한국',
      debut: '고등학생 때 친구 시월과 함께 오디션에 합격해 나란히 데뷔.',
      icon: 'icons/rabbit.png',    portrait: 'portraits/saebyeok.png', from: '#C9A6FF', to: '#F5F5FF',
      abilityName: '디렉터스 아이', abilityDesc: '노트 이동속도 15% 감소(반응시간 증가)', type: 'slowNotes', value: 1.15, barPct: 50 }
  ];
  var CHARACTER_KEY = 'sbg_character_v1';
  function loadActiveCharacterKey() {
    try {
      var raw = window.localStorage.getItem(CHARACTER_KEY);
      if (raw && CHARACTERS.some(function (c) { return c.key === raw; })) return raw;
    } catch (e) {}
    return CHARACTERS[0].key;
  }
  function saveActiveCharacterKey(key) {
    try { window.localStorage.setItem(CHARACTER_KEY, key); } catch (e) {}
  }
  function getCharacter(key) {
    var found = CHARACTERS.filter(function (c) { return c.key === key; })[0];
    return found || CHARACTERS[0];
  }
  var activeCharacterKey = loadActiveCharacterKey();
  var pendingSong = null;      // 캐릭터 선택 화면에 진입할 때 어떤 곡을 고른 상태였는지
  var runBuffs = { comboShieldLeft: 0, missSaveLeft: 0 }; // 이번 판에서 남은 방어/세이브 횟수

  var LANES = ['w', 'a', 's', 'd'];
  var KEY_TO_LANE = {
    KeyW: 'w', ArrowUp: 'w',
    KeyA: 'a', ArrowLeft: 'a',
    KeyS: 's', ArrowDown: 's',
    KeyD: 'd', ArrowRight: 'd'
  };

  // 22-11차: "게임이 좀 어려운 것 같다" 피드백 — 구체적으로 (1) 노트가 너무
  // 빨리 와서 반응할 시간이 부족하고 (2) 박자를 맞춰 눌러도 판정이 너무
  // 빡빡해서 GOOD/MISS가 잘 나온다는 두 가지를 지목. 노트 이동시간과 판정
  // 윈도우를 전부 약 30~40%씩 넉넉하게 늘려 전반적으로 쉽게 조정(5곡 전체
  // 적용). 노트 개수/채보 자체는 손대지 않음 — 이번 피드백 범위 밖.
  var NOTE_TRAVEL = 1.3;       // 노트가 레인 끝에서 허브까지 이동하는 데 걸리는 시간(초) — 기존 1.05초에서 상향(반응 시간 확보)
  var WIN_PERFECT = 0.075;     // 기존 0.055
  var WIN_GREAT = 0.13;        // 기존 0.095
  var WIN_GOOD = 0.22;         // 기존 0.16

  // ------------------------------------------------------ 21차: 스테이지 진행도
  // "1스테이지를 B랭크 이상으로 클리어해야 2스테이지가 열린다"는 순차 잠금
  // 구도. 스테이지 순서 = SONGS 배열 순서(카드 배치 순서) 그대로. 진행도는
  // localStorage에 저장해 다음에 다시 열어도 유지되게 하되(file://에서도
  // localStorage 자체는 정상 동작 — fetch()와 달리 스킴 제약이 없음), 혹시
  // 저장이 막힌 환경(프라이빗 모드 등)이어도 최소한 이번 세션 동안은
  // 메모리 변수(progress)로 계속 동작하도록 try/catch로 감쌌다.
  var PROGRESS_KEY = 'sbg_progress_v1';
  var RANK_ORDER = { S: 5, A: 4, B: 3, C: 2, D: 1 };
  var CLEAR_RANK = 'B'; // 이 랭크 이상이어야 "클리어"로 인정
  function loadProgress() {
    try {
      var raw = window.localStorage.getItem(PROGRESS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed.unlockedIndex === 'number') return parsed;
      }
    } catch (e) {}
    return { unlockedIndex: 0 };
  }
  function saveProgress() {
    try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {}
  }
  var progress = loadProgress();

  // ---------------------------------------------------------------- utils
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---------------------------------------------------------------- styles
  function injectFonts() {
    if (document.getElementById('sbg-fonts')) return;
    var link1 = document.createElement('link');
    link1.rel = 'preconnect'; link1.href = 'https://fonts.googleapis.com';
    var link2 = document.createElement('link');
    link2.rel = 'preconnect'; link2.href = 'https://fonts.gstatic.com'; link2.crossOrigin = 'anonymous';
    var link3 = document.createElement('link');
    link3.id = 'sbg-fonts'; link3.rel = 'stylesheet';
    link3.href = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&family=Press+Start+2P&display=swap';
    document.head.appendChild(link1);
    document.head.appendChild(link2);
    document.head.appendChild(link3);
  }

  function injectStyles() {
    var css = ''
      + '.sbg-overlay{position:fixed;inset:0;z-index:120;display:none;font-family:"Pixelify Sans","Gothic A1",sans-serif;color:#eef1ff;'
      +   'background:radial-gradient(52vw 38vh at 84% 6%,rgba(255,45,158,.28),transparent 62%),radial-gradient(48vw 42vh at 10% 10%,rgba(31,230,255,.2),transparent 64%),radial-gradient(70vw 55vh at 50% 102%,rgba(138,91,255,.22),transparent 66%),linear-gradient(180deg,#090c1c,#05060f 55%);overflow:hidden;}'
      + '.sbg-overlay.is-open{display:block;}'
      + '.sbg-pixel{font-family:"Pixelify Sans",monospace;font-weight:700;}'
      + '.sbg-skyline{position:absolute;left:0;right:0;bottom:0;height:22vh;display:flex;align-items:flex-end;gap:5px;padding:0 3vw;z-index:0;pointer-events:none;opacity:.4;}'
      + '.sbg-bldg{background:linear-gradient(180deg,#0c1230,#070a1c);border-top:1px solid rgba(255,255,255,.06);flex:0 0 auto;}'
      + '.sbg-floorgrid{position:absolute;left:0;right:0;bottom:0;height:38vh;z-index:0;pointer-events:none;opacity:.3;'
      +   'background-image:linear-gradient(rgba(140,150,255,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(140,150,255,.18) 1px,transparent 1px);background-size:46px 46px;'
      +   'transform:perspective(380px) rotateX(62deg);transform-origin:bottom;-webkit-mask-image:linear-gradient(to top,black,transparent 85%);mask-image:linear-gradient(to top,black,transparent 85%);}'

      + '.sbg-close{position:absolute;top:20px;right:24px;z-index:20;width:40px;height:40px;border-radius:50%;border:1px solid rgba(238,241,255,0.24);background:rgba(9,12,28,0.6);color:#eef1ff;font-size:1.1rem;line-height:1;cursor:pointer;backdrop-filter:blur(6px);}'
      + '.sbg-close:hover{border-color:#4FD6E0;color:#4FD6E0;}'

      + '.sbg-screen{position:absolute;inset:0;display:none;flex-direction:column;z-index:2;}'
      + '.sbg-screen.is-active{display:flex;}'

      // ------------------------------------------------------------ select
      // 곡 선택 화면 전용 배경(사용자가 준 픽셀아트 해변 이미지) — 이 두 레이어는
      // #sbg-screen-select 안에서만 존재해서 다른 화면(로딩/플레이/결과)에는
      // 전혀 영향 없음. z-index:-1로 같은 스크린 안의 실제 콘텐츠(정적 위치,
      // z-index 기본값 0 취급)보다 뒤에 깔림.
      + '.sbg-select-bg{position:absolute;inset:-6%;z-index:-1;background-image:url(bg/select_beach.jpg);background-size:cover;background-position:center 40%;filter:saturate(1.05) brightness(.62);}'
      + '.sbg-select-bg-tint{position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(5,6,15,.68) 0%,rgba(5,6,15,.4) 32%,rgba(5,6,15,.52) 68%,rgba(5,6,15,.82) 100%);}'
      + '.sbg-select{align-items:center;justify-content:flex-start;padding:6vh 4vw 3vh;gap:1.8vh;overflow-y:auto;}'
      + '.sbg-title-block{text-align:center;margin-top:1vh;}'
      // 21차: 타이틀 로고만 "Press Start 2P"(진짜 8비트 블록 픽셀 폰트)로 교체하고
      // 색도 두 톤 흰색 글로우 대신 사용자가 준 참고 이미지처럼 단색 하늘색
      // + 하드 픽셀 그림자(블러 없는 오프셋 그림자)로 바꿨다. 나머지 UI 전체는
      // 20차에서 정한 Pixelify Sans를 그대로 유지 — 타이틀 로고 범위만 변경.
      + '.sbg-brand{font-family:"Press Start 2P","Pixelify Sans",monospace;font-weight:400;font-size:clamp(15px,3.3vw,26px);line-height:1.7;letter-spacing:1px;color:#5FD8FF;text-shadow:3px 3px 0 #0B3B57,0 0 18px rgba(95,216,255,.55);}'
      + '.sbg-brand span{color:#5FD8FF;text-shadow:3px 3px 0 #0B3B57,0 0 18px rgba(95,216,255,.55);}'
      + '.sbg-sub{margin-top:10px;color:#8a90c4;font-size:13px;letter-spacing:.5px;}'
      + '.sbg-legend{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin:1.2vh 0 .2vh;}'
      + '.sbg-legend .sbg-litem{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.03);border:1px solid rgba(140,150,255,.18);padding:6px 11px;border-radius:10px;font-size:11.5px;color:#8a90c4;}'
      + '.sbg-legend .sbg-lkey{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:"Pixelify Sans";font-weight:700;font-size:9px;color:#04101c;flex:0 0 auto;}'
      + '.sbg-song-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;width:min(960px,92vw);padding:4px 4px 16px;}'
      + '.sbg-song-card{position:relative;background:linear-gradient(160deg,#111634,#0d1128);border:1px solid rgba(140,150,255,.18);border-radius:14px;padding:0;cursor:pointer;overflow:hidden;isolation:isolate;text-align:left;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;}'
      + '.sbg-song-card::before{content:"";position:absolute;left:0;top:0;right:0;height:3px;background:linear-gradient(90deg,transparent,var(--sbg-accent),transparent);opacity:.8;z-index:2;}'
      + '.sbg-song-card::after{content:"";position:absolute;right:-30px;top:-30px;width:100px;height:100px;border-radius:50%;background:var(--sbg-accent);opacity:.2;filter:blur(20px);z-index:0;}'
      + '.sbg-song-card:hover,.sbg-song-card:focus-visible{transform:translateY(-5px) scale(1.015);border-color:var(--sbg-accent);box-shadow:0 16px 34px -12px var(--sbg-accent),0 0 0 1px var(--sbg-accent) inset;outline:none;}'
      + '.sbg-song-card img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;position:relative;z-index:1;}'
      + '.sbg-song-card .sbg-card-body{position:relative;z-index:1;padding:12px 14px 15px;}'
      + '.sbg-song-card .sbg-tag{font-family:"Pixelify Sans";font-weight:700;font-size:8.5px;color:var(--sbg-accent);letter-spacing:1px;}'
      + '.sbg-song-card h3{margin:8px 0 3px;font-size:16.5px;letter-spacing:.3px;color:#fff;font-weight:600;}'
      + '.sbg-song-card .sbg-genre{display:block;font-size:11px;color:#8a90c4;margin-bottom:6px;}'
      + '.sbg-song-card .sbg-meta{display:flex;gap:10px;color:#8a90c4;font-size:11.5px;font-variant-numeric:tabular-nums;}'
      + '.sbg-song-card .sbg-playbtn{margin-top:10px;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--sbg-accent);letter-spacing:.4px;}'
      + '.sbg-song-card .sbg-playbtn::after{content:"▶";font-size:9px;}'
      // 21차: 스테이지 잠금(진행도) UI. 1스테이지를 B랭크 이상으로 클리어해야
      // 다음 스테이지가 열리는 구도 — 잠긴 카드는 흑백 처리 + 자물쇠 오버레이로
      // 클릭이 막혀 있다는 걸 명확히 보여주고, 클릭 시 살짝 흔들리는 피드백만 준다.
      + '.sbg-stage-badge{position:absolute;left:8px;top:8px;z-index:2;font-family:"Pixelify Sans";font-weight:700;font-size:9px;letter-spacing:.5px;color:#fff;background:rgba(5,6,15,.55);border:1px solid rgba(255,255,255,.25);border-radius:5px;padding:3px 7px;}'
      + '.sbg-song-card.is-locked{cursor:not-allowed;}'
      + '.sbg-song-card.is-locked img{filter:grayscale(1) brightness(.32);}'
      + '.sbg-song-card.is-locked .sbg-card-body{opacity:.4;}'
      + '.sbg-song-card.is-locked:hover{transform:none;box-shadow:none;border-color:rgba(140,150,255,.18);}'
      + '.sbg-lock-badge{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;background:rgba(5,6,15,.6);text-align:center;padding:10px;}'
      + '.sbg-lock-badge .sbg-lock-icon{font-size:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));}'
      + '.sbg-lock-badge span{font-size:10.5px;color:#d3d7fa;letter-spacing:.2px;line-height:1.5;}'
      + '@keyframes sbgShake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(3px)}30%,50%,70%{transform:translateX(-5px)}40%,60%{transform:translateX(5px)}}'
      + '.sbg-song-card.sbg-shake{animation:sbgShake .4s ease;}'
      + '.sbg-hint-block{margin-top:6px;padding:12px 18px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(140,150,255,.18);font-size:.78rem;color:#8a90c4;text-align:center;max-width:640px;}'
      + '.sbg-hint-block b{color:#eef1ff;}'

      // ------------------------------------------------------- 캐릭터 선택 (22차)
      // 22-2~22-4차: 메이플스토리 직업 선택 화면 → 22-5차: 22-1차 카드 그리드
      // + 오른쪽 초상화 패널로 복귀 → 22-6차: "5명이 한 줄로 서서, 클릭하면
      // 커지는" 캐릭터 라인업으로 전면 개편. 곧이어 사용자가 "캐릭터를 더
      // 크게 그리고 스와이프하면 캐릭터가 가운데로 이동하면서 선택되는 UI"를
      // 요청 — 22-7차에서 라인업을 버리고 이 "센터 스냅 캐러셀" 구도로 다시
      // 갈아엎었다. 확인창(이 멤버로 시작하시겠습니까?) 단계는 계속 유지,
      // 상세 프로필(나이/MBTI 등)은 여전히 넣지 않고 이름/역할/능력만.
      //
      // 인터랙션(AskUserQuestion으로 확정): 가운데 캐릭터가 크게 서고 좌우로
      // 옆 캐릭터가 작게 살짝 보인다. (1) 트랙을 좌우로 스와이프/드래그, (2)
      // 화면 양옆의 ‹ › 화살표 버튼, (3) 옆에 살짝 보이는 캐릭터를 직접 클릭
      // — 이 세 가지 모두로 원하는 캐릭터를 가운데로 가져올 수 있다(전부
      // 같은 인덱스 이동 로직을 공유). 가운데로 오면 그 캐릭터가 "선택"된
      // 상태가 되어 아래 정보 카드가 갱신되지만, 실제 확인창은 정보 카드의
      // "이 멤버로 시작" 버튼을 눌러야만 뜬다(가운데 캐릭터를 한 번 더
      // 클릭하는 방식은 이번엔 채택하지 않음 — 버튼이 더 명확한 CTA라서).
      + '.sbg-charselect{padding:0;}'
      + '.sbg-charselect-label{font-size:clamp(14px,2.6vw,20px);letter-spacing:2px;color:#fff;text-shadow:0 0 8px #fff,0 0 20px #4FD6E0;}'
      + '.sbg-charselect-topline{position:absolute;left:0;right:0;top:5%;z-index:2;text-align:center;}'
      + '.sbg-charselect-body{position:absolute;left:0;right:0;top:10%;bottom:3%;z-index:2;display:flex;flex-direction:row;align-items:stretch;justify-content:center;gap:clamp(14px,2.2vw,36px);padding:0 2.2vw;}'
      // 22-8차: 가운데에 큰 캐릭터, 왼쪽에 상세 프로필(이름/직업/능력/나이/
      // MBTI/좋아하는 것/싫어하는 것/국적/데뷔 사연), 오른쪽에 세로 스크롤
      // 선택 리스트(작은 초상화 + 이름) — 사용자가 준 두 참고 이미지(모바일
      // RPG 캐릭터 선택 화면 + 22-3/22-4차의 상세 정보 카드)를 합친 3분할
      // 구도로 22-7차 캐러셀을 대체했다. 오른쪽 리스트를 클릭하면 즉시
      // 가운데/왼쪽이 그 캐릭터로 바뀌고(AskUserQuestion에서 확정), "이
      // 멤버로 시작" 버튼을 눌러야만 확인창이 뜨는 흐름은 22-6/22-7차와
      // 동일하게 유지했다.
      + '.sbg-charselect-left{width:min(460px,34vw);flex:0 0 auto;display:flex;flex-direction:column;justify-content:center;overflow-y:auto;}'
      + '.sbg-charselect-center{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;}'
      + '.sbg-charselect-right{width:min(360px,28vw);flex:0 0 auto;display:flex;flex-direction:column;gap:12px;overflow-y:auto;padding:2px 4px 2px 2px;}'
      // 왼쪽 상세 프로필 카드. (22-8-2/22-8-3차: 사용자 요청으로 3열 전부
      // 두 차례 확대 — 왼쪽 패널/가운데 캐릭터/오른쪽 리스트의 크기와
      // 글자를 계속 키웠다. 사용자가 실제 자기 브라우저(넓은 화면)에서
      // 찍은 스크린샷을 보내 "전체적으로 이정도로 크게"라고 요청 — px
      // 상한(min() 안의 고정값)이 넓은 화면에서도 성장을 막고 있던 게
      // 원인이라, vw 비율은 크게 안 건드리고 px 상한 자체를 크게 올렸다.
      + '.sbg-detail-panel{background:linear-gradient(160deg,rgba(20,24,50,.6),rgba(6,8,20,.55));border:1px solid rgba(140,150,255,.22);border-radius:20px;padding:32px 32px 34px;backdrop-filter:blur(4px);}'
      + '.sbg-detail-name{font-size:clamp(28px,3.4vw,36px);font-weight:800;color:#fff;margin-bottom:4px;}'
      + '.sbg-detail-role{font-size:16px;color:#8a90c4;margin-bottom:19px;}'
      + '.sbg-detail-ability{padding:17px 0;border-top:1px solid rgba(140,150,255,.2);border-bottom:1px solid rgba(140,150,255,.2);margin-bottom:19px;}'
      + '.sbg-detail-ability-name{display:block;font-family:"Pixelify Sans";font-weight:700;font-size:clamp(19px,2.3vw,24px);letter-spacing:.3px;margin-bottom:7px;}'
      + '.sbg-detail-ability-desc{font-size:16px;color:#c7cbef;line-height:1.5;}'
      + '.sbg-detail-ability-bar-track{height:8px;border-radius:999px;background:rgba(255,255,255,.08);margin-top:11px;overflow:hidden;}'
      + '.sbg-detail-ability-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--sbg-c-from,#4FD6E0),var(--sbg-c-to,#F5F5FF));transition:width .3s ease;}'
      + '.sbg-detail-grid{display:grid;grid-template-columns:auto 1fr;row-gap:11px;column-gap:14px;font-size:16px;margin-bottom:19px;}'
      + '.sbg-detail-grid-label{color:#8a90c4;white-space:nowrap;}'
      + '.sbg-detail-grid-value{color:#eef1ff;}'
      + '.sbg-detail-debut-label{font-size:13px;color:#8a90c4;letter-spacing:.5px;margin-bottom:7px;}'
      + '.sbg-detail-debut-text{font-size:16px;color:#c7cbef;line-height:1.6;}'
      // 가운데 큰 캐릭터.
      + '.sbg-center-stage{position:relative;width:min(560px,42vw);height:clamp(520px,74vh,860px);display:flex;align-items:flex-end;justify-content:center;flex-shrink:0;}'
      + '.sbg-center-portrait-glow{position:absolute;left:50%;bottom:4%;width:74%;height:32%;transform:translateX(-50%);border-radius:50%;filter:blur(44px);opacity:.55;background:radial-gradient(circle,var(--sbg-c-to,#4FD6E0),transparent 70%);z-index:0;pointer-events:none;}'
      + '.sbg-center-portrait-img{position:relative;z-index:1;max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 30px 28px rgba(0,0,0,.55)) drop-shadow(0 0 34px var(--sbg-c-to,#4FD6E0));transition:opacity .2s ease;}'
      + '.sbg-center-portrait-fallback{display:none;position:relative;z-index:1;width:58%;height:58%;object-fit:contain;filter:drop-shadow(0 14px 18px rgba(0,0,0,.5));}'
      + '@keyframes sbgCenterPop{0%{transform:scale(.92);opacity:.5;}100%{transform:scale(1);opacity:1;}}'
      + '.sbg-center-stage.sbg-pop .sbg-center-portrait-img,.sbg-center-stage.sbg-pop .sbg-center-portrait-fallback{animation:sbgCenterPop .28s ease;}'
      + '.sbg-center-name-badge{font-size:clamp(21px,2.6vw,28px);font-weight:700;letter-spacing:.3px;padding:10px 30px;border-radius:999px;color:#0c0f22;background:linear-gradient(160deg,var(--sbg-c-from,#4FD6E0),var(--sbg-c-to,#F5F5FF));box-shadow:0 10px 20px -8px rgba(0,0,0,.5);}'
      + '.sbg-center-start-btn{display:inline-block;padding:16px 48px;border-radius:999px;font-size:clamp(18px,2.2vw,22px);font-weight:700;'
        + 'letter-spacing:.3px;color:#0c0f22;background:linear-gradient(160deg,#FFE9A8,#FFB199);cursor:pointer;box-shadow:0 14px 26px -12px rgba(0,0,0,.5);'
        + 'transition:transform .15s ease,box-shadow .15s ease;}'
      + '.sbg-center-start-btn:hover{transform:translateY(-2px);box-shadow:0 18px 30px -12px rgba(0,0,0,.6);}'
      // 오른쪽 선택 리스트 — 작은 초상화 + 이름/역할, 클릭하면 즉시 가운데로.
      + '.sbg-charlist-title{font-size:14px;color:#8a90c4;letter-spacing:1.5px;margin-bottom:3px;padding:0 4px;flex-shrink:0;}'
      + '.sbg-charlist-item{display:flex;align-items:center;gap:16px;padding:14px 16px;border-radius:16px;border:1px solid rgba(140,150,255,.16);background:rgba(255,255,255,.02);cursor:pointer;flex-shrink:0;transition:border-color .15s ease,background .15s ease,transform .12s ease;}'
      + '.sbg-charlist-item:hover{border-color:rgba(140,150,255,.4);background:rgba(255,255,255,.05);transform:translateX(-2px);}'
      + '.sbg-charlist-item.is-selected{border-color:var(--sbg-c-to,#4FD6E0);background:linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.02));box-shadow:0 0 0 1px var(--sbg-c-to,#4FD6E0) inset;}'
      + '.sbg-charlist-thumb{position:relative;width:76px;height:76px;border-radius:15px;overflow:hidden;flex-shrink:0;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.08),rgba(0,0,0,.3));display:flex;align-items:flex-end;justify-content:center;}'
      + '.sbg-charlist-thumb img{width:100%;height:100%;object-fit:contain;object-position:bottom center;}'
      + '.sbg-charlist-thumb .sbg-charlist-thumb-fallback{display:none;width:60%;height:60%;object-fit:contain;}'
      + '.sbg-charlist-text{min-width:0;flex:1 1 auto;}'
      + '.sbg-charlist-name{font-size:18px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.sbg-charlist-role{font-size:13px;color:#8a90c4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.sbg-charlist-current-badge{flex-shrink:0;font-size:11.5px;font-weight:700;letter-spacing:.2px;color:#0c0f22;background:#FFE9A8;padding:5px 9px;border-radius:999px;}'
      + '.sbg-char-back{position:absolute;left:4%;top:6%;z-index:2;font-size:12px;color:#8a90c4;cursor:pointer;letter-spacing:.3px;}'
      + '.sbg-char-back:hover{color:#eef1ff;}'
      // 선택 확인창 — 메이플의 "이 직업군을 선택하시겠습니까? 선택/취소"를
      // 그대로 가져옴. 시작 버튼을 눌러야 실제로 저장+게임 시작이 되고,
      // 취소하면 그냥 닫히기만 하고 아무 것도 안 바뀜.
      + '.sbg-charselect-confirm{position:absolute;inset:0;z-index:6;display:none;align-items:center;justify-content:center;background:rgba(3,4,10,.55);backdrop-filter:blur(2px);}'
      + '.sbg-charselect-confirm.is-open{display:flex;}'
      + '.sbg-charselect-confirm-box{background:linear-gradient(160deg,#151a3a,#0c0f22);border:1px solid rgba(140,150,255,.25);border-radius:18px;padding:28px 32px;text-align:center;box-shadow:0 30px 60px -20px rgba(0,0,0,.7);min-width:260px;}'
      + '.sbg-charselect-confirm-name{font-size:19px;font-weight:700;color:#fff;margin-bottom:6px;}'
      + '.sbg-charselect-confirm-q{font-size:12.5px;color:#c7cbef;margin-bottom:18px;}'
      // 플레이 화면 HUD의 캐릭터 배지(22차부터, 변경 없음).
      + '.sbg-char-hud{display:flex;align-items:center;gap:7px;margin-top:6px;padding:5px 10px !important;}'
      + '.sbg-char-hud img{width:16px;height:16px;object-fit:contain;}'
      + '.sbg-char-hud .sbg-char-hud-text{font-size:9.5px;color:#c7cbef;letter-spacing:.2px;}'
      + '.sbg-char-hud .sbg-char-hud-text b{color:#fff;}'

      // ------------------------------------------------------------ loading
      + '.sbg-loading{align-items:center;justify-content:center;gap:16px;text-align:center;}'
      + '.sbg-spinner{width:50px;height:50px;border-radius:50%;border:4px solid rgba(255,255,255,.12);border-top-color:#4FD6E0;animation:sbg-spin 1s linear infinite;}'
      + '@keyframes sbg-spin{to{transform:rotate(360deg);}}'
      + '.sbg-loading .sbg-loading-label{font-size:12px;color:#8a90c4;letter-spacing:1px;}'

      // ------------------------------------------------------------- play
      + '.sbg-play{align-items:stretch;justify-content:center;}'
      + '.sbg-hud{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;padding:16px 20px;z-index:5;pointer-events:none;}'
      + '.sbg-hud .sbg-block{position:relative;background:linear-gradient(160deg,rgba(20,24,50,.72),rgba(6,8,20,.62));border:1px solid rgba(140,150,255,.18);border-radius:10px;padding:8px 14px;backdrop-filter:blur(4px);}'
      + '.sbg-hud .sbg-score-val{font-family:"Courier New",Consolas,"SFMono-Regular",Menlo,monospace;font-weight:700;font-size:18px;color:#fff;font-variant-numeric:tabular-nums;text-shadow:0 0 10px #FFE9A8;}'
      + '.sbg-hud .sbg-label{font-size:9.5px;color:#8a90c4;letter-spacing:1px;}'
      + '.sbg-hud .sbg-combo-val{font-family:"Courier New",Consolas,"SFMono-Regular",Menlo,monospace;font-weight:700;font-size:20px;color:#FFE9A8;text-shadow:0 0 12px #FFE9A8;text-align:right;}'
      + '.sbg-hud .sbg-songname{font-size:11px;color:#8a90c4;text-align:right;margin-top:2px;max-width:44vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      + '.sbg-backbtn{pointer-events:all;cursor:pointer;background:rgba(6,8,20,.55);border:1px solid rgba(140,150,255,.18);color:#8a90c4;border-radius:8px;padding:6px 10px;font-size:10.5px;margin-top:8px;display:inline-block;}'
      + '.sbg-backbtn:hover{color:#fff;border-color:#FF6FA0;}'
      + '.sbg-progress-wrap{position:absolute;left:0;right:0;bottom:0;height:5px;background:rgba(255,255,255,.06);z-index:5;}'
      + '.sbg-progress-bar{height:100%;width:0%;background:linear-gradient(90deg,#4FD6E0,#C9A6FF,#FF6FA0);box-shadow:0 0 10px #C9A6FF;}'

      + '.sbg-stage{position:relative;flex:1;display:flex;align-items:center;justify-content:center;perspective:1100px;z-index:2;}'
      + '.sbg-stage-bg{position:absolute;inset:-6%;background-size:cover;background-position:center;filter:blur(4px) saturate(1.05) brightness(.32);transform:scale(1.06);opacity:0;transition:opacity .35s ease,background-image .1s linear;z-index:0;}'
      + '.sbg-board{position:relative;width:min(72vmin,600px);height:min(72vmin,600px);transform-style:preserve-3d;transform:rotateX(46deg);z-index:1;}'

      + '.sbg-hub{position:absolute;left:50%;top:50%;width:100px;height:100px;transform:translate(-50%,-50%) translateZ(4px);border-radius:50%;border:3px solid #FFE9A8;'
      +   'box-shadow:0 0 0 3px rgba(255,233,168,.2),0 0 44px 10px rgba(255,233,168,.4),0 0 90px 20px rgba(255,111,160,.16),inset 0 0 30px rgba(255,233,168,.25);'
      +   'background:radial-gradient(circle at 50% 38%,rgba(255,255,255,.35),rgba(255,233,168,.08) 55%,rgba(255,233,168,.02) 75%);}'
      + '.sbg-hub::after{content:"";position:absolute;inset:14px;border-radius:50%;border:1px dashed rgba(255,233,168,.6);animation:sbg-hubspin 7s linear infinite;}'
      + '.sbg-hub .sbg-ring2{position:absolute;inset:-16px;border-radius:50%;border:1px solid rgba(255,233,168,.28);}'
      + '@keyframes sbg-hubspin{to{transform:rotate(360deg);}}'
      + '.sbg-hub .sbg-flash{position:absolute;inset:-14px;border-radius:50%;opacity:0;}'
      + '.sbg-hub .sbg-flash.on{animation:sbg-hubflash .32s ease-out;}'
      + '@keyframes sbg-hubflash{0%{opacity:.9;transform:scale(.7);}100%{opacity:0;transform:scale(1.6);}}'

      + '.sbg-lane{position:absolute;border-radius:4px;transform-style:preserve-3d;}'
      + '.sbg-lane.lane-w{left:50%;bottom:50%;width:120px;height:47%;transform:translateX(-50%);background:linear-gradient(to top,rgba(79,214,224,.02),rgba(79,214,224,.13));border-left:1px solid rgba(79,214,224,.28);border-right:1px solid rgba(79,214,224,.28);}'
      + '.sbg-lane.lane-s{left:50%;top:50%;width:120px;height:47%;transform:translateX(-50%);background:linear-gradient(to bottom,rgba(255,111,160,.02),rgba(255,111,160,.13));border-left:1px solid rgba(255,111,160,.28);border-right:1px solid rgba(255,111,160,.28);}'
      + '.sbg-lane.lane-a{top:50%;right:50%;width:47%;height:120px;transform:translateY(-50%);background:linear-gradient(to left,rgba(255,233,168,.02),rgba(255,233,168,.13));border-top:1px solid rgba(255,233,168,.28);border-bottom:1px solid rgba(255,233,168,.28);}'
      + '.sbg-lane.lane-d{top:50%;left:50%;width:47%;height:120px;transform:translateY(-50%);background:linear-gradient(to right,rgba(201,166,255,.02),rgba(201,166,255,.13));border-top:1px solid rgba(201,166,255,.28);border-bottom:1px solid rgba(201,166,255,.28);}'

      + '.sbg-keytag{position:absolute;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-family:"Pixelify Sans";font-weight:700;font-size:10.5px;border-radius:8px;color:#04101c;z-index:3;transition:transform .08s ease;}'
      + '.sbg-lane.lane-w .sbg-keytag{top:8px;left:50%;transform:translateX(-50%);background:#4FD6E0;box-shadow:0 0 14px #4FD6E0;}'
      + '.sbg-lane.lane-s .sbg-keytag{bottom:8px;left:50%;transform:translateX(-50%);background:#FF6FA0;box-shadow:0 0 14px #FF6FA0;}'
      + '.sbg-lane.lane-a .sbg-keytag{left:8px;top:50%;transform:translateY(-50%);background:#FFE9A8;box-shadow:0 0 14px #FFE9A8;}'
      + '.sbg-lane.lane-d .sbg-keytag{right:8px;top:50%;transform:translateY(-50%);background:#C9A6FF;box-shadow:0 0 14px #C9A6FF;}'
      + '.sbg-keytag.is-pressed{transform:translateX(-50%) scale(0.86);}'
      + '.sbg-lane.lane-a .sbg-keytag.is-pressed,.sbg-lane.lane-d .sbg-keytag.is-pressed{transform:translateY(-50%) scale(0.86);}'

      // 3D 복셀 노트: 위/앞 두 면만 보이는 큐브 (preserve-3d, 기울어진 보드
      // 안에서 렌더링). opacity/필터가 preserve-3d를 가진 조상에 걸리면
      // 평면화되어 회전된 면들이 얇게 찌그러지므로, 페이드는 바깥의 평범한
      // .sbg-note에 두고 .sbg-cube만 preserve-3d를 갖는다.
      + '.sbg-note{position:absolute;width:0;height:0;pointer-events:none;transform-style:preserve-3d;}'
      + '.sbg-note .sbg-cube{position:absolute;width:0;height:0;transform-style:preserve-3d;}'
      + '.sbg-note .sbg-vf{position:absolute;left:-13px;top:-13px;width:26px;height:26px;border:1px solid rgba(255,255,255,.18);opacity:var(--sbg-fade,1);}'
      + '.sbg-note .sbg-vf-top{background:linear-gradient(155deg,#ffffff,var(--sbg-c2) 55%,var(--sbg-c1));box-shadow:0 0 14px var(--sbg-glow);transform:rotateX(90deg) translateZ(13px);}'
      + '.sbg-note .sbg-vf-front{background:linear-gradient(165deg,var(--sbg-c1),var(--sbg-c3) 70%);box-shadow:0 0 16px var(--sbg-glow);transform:translateZ(13px);}'
      + '.sbg-note.lane-w{--sbg-c1:#c9f7fb;--sbg-c2:#eafeff;--sbg-c3:#4FD6E0;--sbg-glow:#4FD6E0;}'
      + '.sbg-note.lane-s{--sbg-c1:#ffc9dc;--sbg-c2:#ffe6ef;--sbg-c3:#FF6FA0;--sbg-glow:#FF6FA0;}'
      + '.sbg-note.lane-a{--sbg-c1:#fff3cf;--sbg-c2:#fffbe9;--sbg-c3:#FFE9A8;--sbg-glow:#FFE9A8;}'
      + '.sbg-note.lane-d{--sbg-c1:#ece0ff;--sbg-c2:#f7f1ff;--sbg-c3:#C9A6FF;--sbg-glow:#C9A6FF;}'

      + '.sbg-judgetext{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family:"Pixelify Sans";font-weight:700;font-size:15px;z-index:6;pointer-events:none;white-space:nowrap;text-shadow:0 0 10px currentColor;}'
      + '.sbg-judgetext.perfect{color:#FFE9A8;} .sbg-judgetext.great{color:#4FD6E0;} .sbg-judgetext.good{color:#C9A6FF;} .sbg-judgetext.miss{color:#FF6FA0;}'
      + '@keyframes sbg-popfade{0%{opacity:0;transform:translate(-50%,-50%) translateY(0) scale(.7);}18%{opacity:1;transform:translate(-50%,-50%) translateY(-6px) scale(1.05);}100%{opacity:0;transform:translate(-50%,-50%) translateY(-46px) scale(1);}}'
      + '.sbg-judgetext.run{animation:sbg-popfade .62s ease-out forwards;}'

      + '.sbg-countdown{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:8;pointer-events:none;}'
      + '.sbg-countdown .sbg-cd-num{font-family:"Pixelify Sans";font-weight:700;font-size:min(16vw,120px);color:#fff;text-shadow:0 0 30px #4FD6E0;opacity:0;}'
      + '.sbg-countdown .sbg-cd-num.show{animation:sbg-cdpop .82s ease-out;}'
      + '@keyframes sbg-cdpop{0%{opacity:0;transform:scale(1.7);}20%{opacity:1;transform:scale(1);}75%{opacity:1;}100%{opacity:0;transform:scale(.8);}}'

      + '.sbg-play-controls{display:none;}'

      // ------------------------------------------------------------ results
      + '.sbg-results{align-items:center;justify-content:center;}'
      + '.sbg-results-card{background:linear-gradient(160deg,#111634,#0d1128);border:1px solid rgba(140,150,255,.18);border-radius:18px;padding:32px 38px;width:min(460px,90vw);text-align:center;box-shadow:0 30px 60px -20px rgba(0,0,0,.6);}'
      + '.sbg-rank{font-family:"Pixelify Sans";font-weight:700;font-size:58px;margin:6px 0 10px;text-shadow:0 0 26px currentColor;}'
      + '.sbg-rank.S{color:#FFE9A8;} .sbg-rank.A{color:#4FD6E0;} .sbg-rank.B{color:#C9A6FF;} .sbg-rank.C{color:#8CE99A;} .sbg-rank.D{color:#FF6FA0;}'
      + '.sbg-results-card h2{margin:0 0 4px;font-size:13px;letter-spacing:1px;color:#8a90c4;font-weight:500;}'
      + '.sbg-results-song{font-size:13px;color:#eef1ff;margin-bottom:8px;}'
      // 22-10차: "Pixelify Sans"는 숫자 5와 9의 글자 모양이 사실상 동일하게
      // 나와서(폰트 자체의 디자인 특성) 정확도%/점수/판정 개수를 착각하게
      // 만드는 문제가 있었다 — 숫자가 들어가는 요소는 전부 또렷이 구분되는
      // 모노스페이스 폰트로 분리(.sbg-num, 아래 관련 규칙들도 동일).
      + '.sbg-num{font-family:"Courier New",Consolas,"SFMono-Regular",Menlo,monospace;font-variant-numeric:tabular-nums;}'
      + '.sbg-results-score{font-family:"Courier New",Consolas,"SFMono-Regular",Menlo,monospace;font-weight:700;font-size:27px;color:#fff;margin:6px 0 16px;font-variant-numeric:tabular-nums;}'
      + '.sbg-unlock-note{display:none;font-size:11.5px;font-weight:700;color:#8CE99A;letter-spacing:.3px;margin:-8px 0 14px;padding:7px 10px;border:1px solid rgba(140,233,154,.35);border-radius:8px;background:rgba(140,233,154,.08);}'
      + '.sbg-unlock-note.is-shown{display:block;}'
      + '.sbg-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;text-align:left;margin-bottom:22px;}'
      + '.sbg-stat-grid .sbg-row{display:flex;justify-content:space-between;font-size:12.5px;padding:6px 10px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(140,150,255,.18);}'
      + '.sbg-stat-grid .sbg-row b{font-family:"Courier New",Consolas,"SFMono-Regular",Menlo,monospace;font-variant-numeric:tabular-nums;color:#fff;}'
      + '.sbg-stat-grid .perfect b{color:#FFE9A8;} .sbg-stat-grid .great b{color:#4FD6E0;} .sbg-stat-grid .good b{color:#C9A6FF;} .sbg-stat-grid .miss b{color:#FF6FA0;}'
      + '.sbg-btnrow{display:flex;gap:12px;justify-content:center;}'
      + '.sbg-btn{cursor:pointer;border:1px solid rgba(140,150,255,.18);background:rgba(255,255,255,.04);color:#fff;padding:10px 18px;border-radius:10px;font-size:12.5px;letter-spacing:.4px;transition:border-color .15s,transform .15s;}'
      + '.sbg-btn:hover{transform:translateY(-2px);}'
      + '.sbg-btn.sbg-primary{border-color:#4FD6E0;color:#4FD6E0;box-shadow:0 0 18px -6px #4FD6E0;}'
      + '.sbg-btn.sbg-ghost:hover{border-color:#FF6FA0;color:#FF6FA0;}'

      + '@media (max-width:900px){.sbg-board{width:min(80vmin,420px);height:min(80vmin,420px);}}'
    ;
    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // ------------------------------------------------------------------ DOM
  var root, selectScreen, charSelectScreen, loadingScreen, playScreen, resultsScreen;
  var songGrid, loadingLabel;
  var scoreEl, comboEl, songNameEl, progressBar, stageBgEl, boardEl, hubFlashEl, countdownEl, countdownNumEl;
  var laneEls, keytagEls;
  var resultsRankEl, resultsSongEl, resultsScoreEl, resultsStatEl;

  function buildDOM() {
    root = document.createElement('div');
    root.className = 'sbg-overlay';
    root.innerHTML =
      '<div class="sbg-skyline" id="sbg-skyline"></div>' +
      '<div class="sbg-floorgrid"></div>' +
      '<button class="sbg-close" type="button" aria-label="닫기">✕</button>' +

      '<div class="sbg-screen sbg-select" id="sbg-screen-select">' +
        '<div class="sbg-select-bg"></div>' +
        '<div class="sbg-select-bg-tint"></div>' +
        '<div class="sbg-title-block">' +
          '<div class="sbg-pixel sbg-brand">SUMMER <span>BREEZE</span></div>' +
          '<div class="sbg-sub">복셀 리듬 아케이드 · 노트가 오는 방향의 키를 눌러요 (PC 키보드 전용)</div>' +
        '</div>' +
        '<div class="sbg-legend">' +
          '<div class="sbg-litem"><span>▲</span> 위에서 오면 <span class="sbg-lkey" style="background:#4FD6E0">W</span></div>' +
          '<div class="sbg-litem"><span>▼</span> 아래에서 오면 <span class="sbg-lkey" style="background:#FF6FA0">S</span></div>' +
          '<div class="sbg-litem"><span>◀</span> 왼쪽에서 오면 <span class="sbg-lkey" style="background:#FFE9A8">A</span></div>' +
          '<div class="sbg-litem"><span>▶</span> 오른쪽에서 오면 <span class="sbg-lkey" style="background:#C9A6FF">D</span></div>' +
        '</div>' +
        '<div class="sbg-song-grid" id="sbg-song-grid"></div>' +
        '<div class="sbg-hint-block">비트맵(노트 타이밍)은 오디오 파형에서 <b>자동 생성</b>한 근사치입니다 — 정확한 사람 손 채보가 아니에요.</div>' +
      '</div>' +

      '<div class="sbg-screen sbg-charselect" id="sbg-screen-charselect">' +
        '<div class="sbg-select-bg"></div>' +
        '<div class="sbg-select-bg-tint"></div>' +
        '<div class="sbg-charselect-topline">' +
          '<div class="sbg-charselect-label sbg-pixel">CHOOSE YOUR MEMBER</div>' +
          '<div class="sbg-sub" id="sbg-charselect-song">—</div>' +
        '</div>' +
        '<div class="sbg-charselect-body">' +
          '<div class="sbg-charselect-left" id="sbg-charselect-left"></div>' +
          '<div class="sbg-charselect-center">' +
            '<div class="sbg-center-stage" id="sbg-center-stage">' +
              '<div class="sbg-center-portrait-glow" id="sbg-center-glow"></div>' +
              '<img class="sbg-center-portrait-img" id="sbg-center-img" alt="">' +
              '<img class="sbg-center-portrait-fallback" id="sbg-center-fallback" alt="">' +
            '</div>' +
            '<div class="sbg-center-name-badge" id="sbg-center-name-badge">—</div>' +
            '<div class="sbg-center-start-btn" id="sbg-center-start-btn">이 멤버로 시작</div>' +
          '</div>' +
          '<div class="sbg-charselect-right" id="sbg-charselect-right"></div>' +
        '</div>' +
        '<div class="sbg-char-back" id="sbg-char-back">← 곡 선택으로</div>' +
        '<div class="sbg-charselect-confirm" id="sbg-charselect-confirm">' +
          '<div class="sbg-charselect-confirm-box">' +
            '<div class="sbg-charselect-confirm-name" id="sbg-confirm-name">—</div>' +
            '<div class="sbg-charselect-confirm-q">이 멤버로 시작하시겠습니까?</div>' +
            '<div class="sbg-btnrow">' +
              '<div class="sbg-btn sbg-primary" id="sbg-confirm-start">시작</div>' +
              '<div class="sbg-btn sbg-ghost" id="sbg-confirm-cancel">취소</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="sbg-screen sbg-loading" id="sbg-screen-loading">' +
        '<div class="sbg-spinner"></div>' +
        '<div class="sbg-pixel sbg-loading-label" id="sbg-loading-label">불러오는 중...</div>' +
      '</div>' +

      '<div class="sbg-screen sbg-play" id="sbg-screen-play">' +
        '<div class="sbg-hud">' +
          '<div>' +
            '<div class="sbg-block"><div class="sbg-label">SCORE</div><div class="sbg-score-val" id="sbg-score">0</div></div>' +
            '<div class="sbg-block sbg-char-hud" id="sbg-char-hud"></div>' +
            '<div class="sbg-backbtn" id="sbg-back-btn">← 곡 선택</div>' +
          '</div>' +
          '<div>' +
            '<div class="sbg-block"><div class="sbg-combo-val" id="sbg-combo">0<span style="font-size:11px;"> combo</span></div><div class="sbg-songname" id="sbg-hud-songname"></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="sbg-stage">' +
          '<div class="sbg-stage-bg" id="sbg-stage-bg"></div>' +
          '<div class="sbg-board" id="sbg-board">' +
            '<div class="sbg-lane lane-w"><div class="sbg-keytag">W</div></div>' +
            '<div class="sbg-lane lane-s"><div class="sbg-keytag">S</div></div>' +
            '<div class="sbg-lane lane-a"><div class="sbg-keytag">A</div></div>' +
            '<div class="sbg-lane lane-d"><div class="sbg-keytag">D</div></div>' +
            '<div class="sbg-hub" id="sbg-hub"><div class="sbg-ring2"></div><div class="sbg-flash" id="sbg-hub-flash"></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="sbg-countdown" id="sbg-countdown"><div class="sbg-cd-num sbg-pixel" id="sbg-cd-num"></div></div>' +
        '<div class="sbg-progress-wrap"><div class="sbg-progress-bar" id="sbg-progress"></div></div>' +
      '</div>' +

      '<div class="sbg-screen sbg-results" id="sbg-screen-results">' +
        '<div class="sbg-results-card">' +
          '<h2>RESULT</h2>' +
          '<div class="sbg-rank sbg-pixel" id="sbg-rank">S</div>' +
          '<div class="sbg-results-song" id="sbg-results-song">—</div>' +
          '<div class="sbg-results-score sbg-pixel" id="sbg-results-score">0</div>' +
          '<div class="sbg-unlock-note" id="sbg-unlock-note"></div>' +
          '<div class="sbg-stat-grid" id="sbg-stat-grid"></div>' +
          '<div class="sbg-btnrow">' +
            '<div class="sbg-btn sbg-primary" id="sbg-retry-btn">다시하기</div>' +
            '<div class="sbg-btn sbg-ghost" id="sbg-toselect-btn">곡 선택으로</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    selectScreen = root.querySelector('#sbg-screen-select');
    charSelectScreen = root.querySelector('#sbg-screen-charselect');
    loadingScreen = root.querySelector('#sbg-screen-loading');
    playScreen = root.querySelector('#sbg-screen-play');
    resultsScreen = root.querySelector('#sbg-screen-results');
    songGrid = root.querySelector('#sbg-song-grid');
    loadingLabel = root.querySelector('#sbg-loading-label');
    scoreEl = root.querySelector('#sbg-score');
    comboEl = root.querySelector('#sbg-combo');
    songNameEl = root.querySelector('#sbg-hud-songname');
    progressBar = root.querySelector('#sbg-progress');
    stageBgEl = root.querySelector('#sbg-stage-bg');
    boardEl = root.querySelector('#sbg-board');
    hubFlashEl = root.querySelector('#sbg-hub-flash');
    countdownEl = root.querySelector('#sbg-countdown');
    countdownNumEl = root.querySelector('#sbg-cd-num');
    resultsRankEl = root.querySelector('#sbg-rank');
    resultsSongEl = root.querySelector('#sbg-results-song');
    resultsScoreEl = root.querySelector('#sbg-results-score');
    resultsStatEl = root.querySelector('#sbg-stat-grid');
    laneEls = {
      w: root.querySelector('.sbg-lane.lane-w'),
      a: root.querySelector('.sbg-lane.lane-a'),
      s: root.querySelector('.sbg-lane.lane-s'),
      d: root.querySelector('.sbg-lane.lane-d')
    };
    keytagEls = {
      w: laneEls.w.querySelector('.sbg-keytag'),
      a: laneEls.a.querySelector('.sbg-keytag'),
      s: laneEls.s.querySelector('.sbg-keytag'),
      d: laneEls.d.querySelector('.sbg-keytag')
    };

    // 장식용 스카이라인 (Pixel Pulse의 buildSkyline 이식) — 시드 고정 난수로
    // 매번 같은 배치를 생성해 깜빡임 없이 일관된 배경을 보여준다.
    (function buildSkyline() {
      var layer = root.querySelector('#sbg-skyline');
      var seed = 20260824;
      function rng() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }
      var n = 26, html = '';
      for (var i = 0; i < n; i++) {
        var h = 30 + rng() * 130;
        var w = 20 + rng() * 28;
        var tint = rng() < 0.5 ? '#4FD6E0' : '#C9A6FF';
        html += '<div class="sbg-bldg" style="width:' + w + 'px;height:' + h + 'px;box-shadow:inset 0 0 20px ' + tint + '22;"></div>';
      }
      layer.innerHTML = html;
    })();

    root.querySelector('.sbg-close').addEventListener('click', closeOverlay);
    root.querySelector('#sbg-back-btn').addEventListener('click', function () { stopPlayback(); showScreen('select'); });
    root.querySelector('#sbg-retry-btn').addEventListener('click', function () { stopPlayback(); if (currentSong) startSong(currentSong.song); });
    root.querySelector('#sbg-toselect-btn').addEventListener('click', function () { stopPlayback(); showScreen('select'); });
    root.querySelector('#sbg-char-back').addEventListener('click', function () { pendingSong = null; showScreen('select'); });
    // 22-8차: 가운데 "이 멤버로 시작" 버튼 — 화면 안에 하나뿐인 정적 버튼이라
    // (오른쪽 리스트 항목들과 달리) 화면을 열 때마다 새로 그리지 않고 여기서
    // 한 번만 리스너를 붙인다. 지금 선택된 캐릭터(selectedCharKey)에 대해
    // 확인창을 연다.
    root.querySelector('#sbg-center-start-btn').addEventListener('click', function () {
      openCharConfirm(selectedCharKey);
    });
    root.querySelector('#sbg-confirm-cancel').addEventListener('click', closeCharConfirm);
    root.querySelector('#sbg-confirm-start').addEventListener('click', function () {
      activeCharacterKey = previewCharacterKey;
      saveActiveCharacterKey(activeCharacterKey);
      closeCharConfirm();
      var songToStart = pendingSong;
      pendingSong = null;
      if (songToStart) startSong(songToStart);
    });

    renderSongGrid();

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('keyup', handleKeyup);
  }

  // 21차: 곡 카드 그리드를 다시 그리는 함수로 분리 — 스테이지를 클리어해서
  // progress.unlockedIndex가 바뀔 때마다 다시 호출해 잠금 UI를 갱신한다.
  function renderSongGrid() {
    songGrid.innerHTML = SONGS.map(function (s, i) {
      var locked = i > progress.unlockedIndex;
      var lockedNote = i === 0 ? '' :
        (SONGS[i - 1].title + '을(를) ' + CLEAR_RANK + '랭크 이상으로 클리어하면 열려요');
      return '<button type="button" class="sbg-song-card' + (locked ? ' is-locked' : '') + '" style="--sbg-accent:' + s.accent + '" data-song="' + s.key + '" aria-disabled="' + (locked ? 'true' : 'false') + '">' +
        '<div class="sbg-stage-badge">STAGE ' + (i + 1) + '</div>' +
        '<img src="' + s.cover + '" alt="' + s.title + ' 앨범 표지">' +
        '<div class="sbg-card-body">' +
        '<div class="sbg-tag">' + s.tagLabel + '</div>' +
        '<h3>' + s.title + '</h3>' +
        '<span class="sbg-genre">' + s.genre + '</span>' +
        '<div class="sbg-meta"><span>⏱ ' + s.durLabel + '</span></div>' +
        '<div class="sbg-playbtn">PLAY</div>' +
        '</div>' +
        (locked ? '<div class="sbg-lock-badge"><div class="sbg-lock-icon">🔒</div><span>' + lockedNote + '</span></div>' : '') +
        '</button>';
    }).join('');
    Array.prototype.forEach.call(songGrid.querySelectorAll('.sbg-song-card'), function (card) {
      card.addEventListener('click', function () {
        if (card.classList.contains('is-locked')) {
          card.classList.remove('sbg-shake');
          void card.offsetWidth; // 애니메이션 재시작을 위한 강제 리플로우
          card.classList.add('sbg-shake');
          return;
        }
        var meta = SONGS.filter(function (s) { return s.key === card.getAttribute('data-song'); })[0];
        if (meta) openCharSelect(meta);
      });
    });
  }

  // 22차: 곡을 고른 직후, 로딩 전에 캐릭터(멤버) 선택 화면을 보여준다.
  // 22-5차 카드 그리드 → 22-6차 클릭형 라인업 → 22-7차 센터 스냅 캐러셀을
  // 거쳐, 22-8차에서 사용자가 준 두 참고 이미지(모바일 RPG 캐릭터 선택
  // 화면 + 22-3/22-4차의 상세 정보 카드)를 합쳐 "가운데 큰 캐릭터 + 왼쪽
  // 상세 프로필 + 오른쪽 세로 선택 리스트" 3분할 구도로 다시 갈아엎었다.
  // 확인창(이 멤버로 시작하시겠습니까?) 단계는 계속 유지하되, 22-5차에서
  // 뺐던 상세 프로필(나이/MBTI/좋아하는 것/싫어하는 것/국적/데뷔 사연)을
  // 왼쪽 패널로 되살렸다 — 데이터는 22-2/22-3차부터 CHARACTERS 배열에
  // 계속 있던 것을 그대로 재사용, 새로 지어내지 않았다.
  //
  // selectedCharKey = 지금 가운데/왼쪽에 표시 중인(=선택된) 캐릭터의 key.
  // previewCharacterKey는 확인창이 지금 어떤 캐릭터에 대해 열려있는지만
  // 기억한다(openCharConfirm에서 설정, 이전 차수와 동일).
  var selectedCharKey = null;
  var previewCharacterKey = null;

  function openCharSelect(song) {
    pendingSong = song;
    selectedCharKey = activeCharacterKey;
    var charSongEl = root.querySelector('#sbg-charselect-song');
    if (charSongEl) charSongEl.textContent = song.title + ' — 함께할 멤버를 골라주세요';
    renderCharRight();
    selectCharacter(selectedCharKey, false);
    closeCharConfirm();
    showScreen('character');
  }

  // 오른쪽 세로 리스트 — 5명뿐이라 캐러셀처럼 DOM을 유지할 필요 없이 화면을
  //열 때 통째로 한 번 그린다. 항목을 클릭하면 즉시 가운데/왼쪽이 그
  // 캐릭터로 바뀐다(AskUserQuestion에서 "클릭 시 가운데로 즉시 전환"으로
  // 확정 — 스와이프/드래그는 이번 구도에서는 채택하지 않음).
  function renderCharRight() {
    var listEl = root.querySelector('#sbg-charselect-right');
    if (!listEl) return;
    listEl.innerHTML = '<div class="sbg-charlist-title">MEMBERS</div>' +
      CHARACTERS.map(function (c) {
        return '<div class="sbg-charlist-item" data-char="' + c.key + '" style="--sbg-c-from:' + c.from + ';--sbg-c-to:' + c.to + '">' +
          '<div class="sbg-charlist-thumb">' +
            '<img class="sbg-charlist-thumb-img" alt="' + c.name + '" src="' + c.portrait + '">' +
            '<img class="sbg-charlist-thumb-fallback" alt="' + c.name + '" src="' + c.icon + '">' +
          '</div>' +
          '<div class="sbg-charlist-text">' +
            '<div class="sbg-charlist-name">' + c.name + '</div>' +
            '<div class="sbg-charlist-role">' + c.role + '</div>' +
          '</div>' +
          (c.key === activeCharacterKey ? '<div class="sbg-charlist-current-badge">CURRENT</div>' : '') +
        '</div>';
      }).join('');
    Array.prototype.forEach.call(listEl.querySelectorAll('.sbg-charlist-item'), function (item) {
      var img = item.querySelector('.sbg-charlist-thumb-img');
      var fallback = item.querySelector('.sbg-charlist-thumb-fallback');
      img.addEventListener('error', function () { img.style.display = 'none'; fallback.style.display = 'block'; });
      img.addEventListener('load', function () { img.style.display = ''; fallback.style.display = 'none'; });
      item.addEventListener('click', function () { selectCharacter(item.getAttribute('data-char'), true); });
    });
    updateCharlistSelection();
  }

  function updateCharlistSelection() {
    var listEl = root.querySelector('#sbg-charselect-right');
    if (!listEl) return;
    Array.prototype.forEach.call(listEl.querySelectorAll('.sbg-charlist-item'), function (item) {
      item.classList.toggle('is-selected', item.getAttribute('data-char') === selectedCharKey);
    });
  }

  // 가운데 큰 캐릭터 + 왼쪽 상세 프로필을 selectedCharKey 기준으로 갱신한다.
  // pop=true면 가운데 초상화에 살짝 튀어오르는 등장 애니메이션을 준다(화면을
  // 처음 열 때는 필요 없어서 openCharSelect에서는 false로 부른다).
  function selectCharacter(key, pop) {
    selectedCharKey = key;
    var c = getCharacter(key);

    var stage = root.querySelector('#sbg-center-stage');
    var img = root.querySelector('#sbg-center-img');
    var fallback = root.querySelector('#sbg-center-fallback');
    var nameBadge = root.querySelector('#sbg-center-name-badge');
    if (stage) { stage.style.setProperty('--sbg-c-from', c.from); stage.style.setProperty('--sbg-c-to', c.to); }
    if (img) { img.src = c.portrait; img.alt = c.name; img.style.display = ''; }
    if (fallback) { fallback.src = c.icon; fallback.alt = c.name; fallback.style.display = 'none'; }
    if (nameBadge) nameBadge.textContent = c.name;
    if (pop && stage) {
      stage.classList.remove('sbg-pop');
      void stage.offsetWidth; // 애니메이션 재시작을 위한 강제 리플로우
      stage.classList.add('sbg-pop');
    }

    renderCharLeft(c);
    updateCharlistSelection();
  }

  // 왼쪽 상세 프로필 카드 — 이름/직업/능력(막대바 포함)/나이/MBTI/좋아하는
  // 것/싫어하는 것/국적/데뷔 사연. 22-5차에서 한 번 뺐던 상세 정보를
  // 사용자 요청으로 22-8차에서 되살렸다.
  function renderCharLeft(c) {
    var leftEl = root.querySelector('#sbg-charselect-left');
    if (!leftEl) return;
    leftEl.innerHTML =
      '<div class="sbg-detail-panel" style="--sbg-c-from:' + c.from + ';--sbg-c-to:' + c.to + '">' +
        '<div class="sbg-detail-name">' + c.name + '</div>' +
        '<div class="sbg-detail-role">' + c.role + '</div>' +
        '<div class="sbg-detail-ability">' +
          '<span class="sbg-detail-ability-name" style="color:' + c.to + '">' + c.abilityName + '</span>' +
          '<span class="sbg-detail-ability-desc">' + c.abilityDesc + '</span>' +
          '<div class="sbg-detail-ability-bar-track"><div class="sbg-detail-ability-bar-fill" style="width:' + c.barPct + '%"></div></div>' +
        '</div>' +
        '<div class="sbg-detail-grid">' +
          '<div class="sbg-detail-grid-label">나이</div><div class="sbg-detail-grid-value">' + c.age + '세</div>' +
          '<div class="sbg-detail-grid-label">MBTI</div><div class="sbg-detail-grid-value">' + c.mbti + '</div>' +
          '<div class="sbg-detail-grid-label">좋아하는 것</div><div class="sbg-detail-grid-value">' + c.likes + '</div>' +
          '<div class="sbg-detail-grid-label">싫어하는 것</div><div class="sbg-detail-grid-value">' + c.dislikes + '</div>' +
          '<div class="sbg-detail-grid-label">국적</div><div class="sbg-detail-grid-value">' + c.nation + '</div>' +
        '</div>' +
        '<div class="sbg-detail-debut-label">데뷔 사연</div>' +
        '<div class="sbg-detail-debut-text">' + c.debut + '</div>' +
      '</div>';
  }

  function openCharConfirm(key) {
    previewCharacterKey = key;
    var c = getCharacter(key);
    var nameEl = root.querySelector('#sbg-confirm-name');
    if (nameEl) nameEl.textContent = c.name + ' · ' + c.abilityName;
    var confirmEl = root.querySelector('#sbg-charselect-confirm');
    if (confirmEl) confirmEl.classList.add('is-open');
  }
  function closeCharConfirm() {
    var confirmEl = root && root.querySelector('#sbg-charselect-confirm');
    if (confirmEl) confirmEl.classList.remove('is-open');
  }

  function showScreen(name) {
    [selectScreen, charSelectScreen, loadingScreen, playScreen, resultsScreen].forEach(function (s) { s.classList.remove('is-active'); });
    if (name === 'select') selectScreen.classList.add('is-active');
    if (name === 'character') charSelectScreen.classList.add('is-active');
    if (name === 'loading') loadingScreen.classList.add('is-active');
    if (name === 'play') playScreen.classList.add('is-active');
    if (name === 'results') resultsScreen.classList.add('is-active');
  }

  // --------------------------------------------------------- audio engine
  // <audio> 엘리먼트 기반 재생 — file://로 직접 열어도(로컬 zip 압축해제 후
  // 더블클릭) 정상 작동함이 검증된 방식(13~18차부터 사용, 19-1차에서 fetch()
  // 기반 방식이 file://에서 깨지는 걸 발견하고 이 방식으로 되돌림).
  var playAudio = null;
  var currentSong = null;      // {song, duration, notes}
  var rafId = null;
  var score = 0, combo = 0, maxCombo = 0;
  var counts = { perfect: 0, great: 0, good: 0, miss: 0 };
  var endedHandled = false;

  // 22-9차: "노트가 처음부터(시작하자마자) 나와서 당황스럽다"는 피드백 —
  // 원인은 일부 곡의 첫 노트가 오디오 시작 직후(예: 0.05초)에 있는데, 노트가
  // 레인 끝에서 허브까지 이동하는 데 NOTE_TRAVEL(1.05초, 능력에 따라 최대
  // 1.15배)이 걸리므로 그 노트는 화면이 뜨자마자 이미 "도착 직전" 상태로
  // 순간이동하듯 나타나 버렸던 것(스폰 시각 = note.t - travel*1.09가 음수).
  // 해결: 카운트다운이 끝난 직후 곧바로 오디오를 재생하지 않고, 그 대신
  // 가상 시계를 -LEAD_IN초부터 실시간으로 흐르게 하다가(이 구간엔 소리 없이
  // 노트만 화면에 나타나 정상 속도로 이동), 가상 시계가 정확히 0에 도달하는
  // 순간(=실제 곡 시작 시점) 오디오 재생을 시작한다 — 노트 시각(note.t) 자체는
  // 전혀 안 바꾸므로 오디오 내용과의 싱크는 그대로 유지되고, 첫 노트도 항상
  // 완전한 이동 애니메이션을 거쳐 등장한다. LEAD_IN=1.9초는 최대 이동시간
  // (22-11차로 NOTE_TRAVEL이 1.3초로 늘어나 1.3*1.15≈1.5초)보다 여유 있게
  // 길게 잡은 값(22-11차: 1.05→1.3초 상향에 맞춰 1.6→1.9초로 같이 상향).
  var LEAD_IN = 1.9;
  var goAt = null;          // performance.now() 기준, "GO!" 직후 리드인이 시작된 시각
  var audioLaunched = false; // 리드인이 끝나 실제 playAudio.play()를 호출했는지

  function startSong(song) {
    var bm = BEATMAPS[song.key];
    if (!bm) return;
    stopPlayback();
    currentSong = {
      song: song,
      duration: bm.duration,
      notes: bm.notes.map(function (n) { return { t: n.t, lane: n.lane, judged: false, el: null }; })
    };
    score = 0; combo = 0; maxCombo = 0;
    counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    endedHandled = false;

    // 22차: 이번 판에 적용할 캐릭터 능력을 초기화 — 콤보 방어/미스 세이브
    // 횟수는 곡을 새로 시작할 때마다(다시하기 포함) 매번 가득 채워서 시작한다.
    var activeChar = getCharacter(activeCharacterKey);
    runBuffs = {
      comboShieldLeft: activeChar.type === 'comboShield' ? activeChar.value : 0,
      missSaveLeft: activeChar.type === 'missSave' ? activeChar.value : 0
    };
    renderCharHud();

    showScreen('loading');
    loadingLabel.textContent = song.title + ' 불러오는 중...';

    if (playAudio) {
      try { playAudio.pause(); } catch (e) {}
      if (playAudio.parentNode) playAudio.parentNode.removeChild(playAudio);
    }
    playAudio = document.createElement('audio');
    playAudio.preload = 'auto';
    playAudio.src = song.file;
    document.body.appendChild(playAudio);

    var proceeded = false;
    function proceed() {
      if (proceeded) return;
      proceeded = true;
      prepareGameScreen();
      beginCountdown();
    }
    playAudio.addEventListener('canplaythrough', proceed, { once: true });
    playAudio.addEventListener('error', function () {
      loadingLabel.textContent = '오디오 로드 실패 :( 파일이 손상되지 않았는지 확인해주세요.';
    });
    playAudio.load();
    // 로컬 파일은 보통 거의 즉시 buffering이 끝나지만, 혹시 canplaythrough가
    // 늦게 오는 환경을 대비한 안전장치.
    setTimeout(proceed, 1200);
  }

  function prepareGameScreen() {
    scoreEl.textContent = '0';
    comboEl.innerHTML = '0<span style="font-size:11px;"> combo</span>';
    songNameEl.textContent = currentSong.song.title;
    progressBar.style.width = '0%';
    var old = boardEl.querySelectorAll('.sbg-note, .sbg-judgetext');
    Array.prototype.forEach.call(old, function (n) { n.remove(); });
    if (stageBgEl) {
      stageBgEl.style.backgroundImage = 'url(' + currentSong.song.cover + ')';
      stageBgEl.style.opacity = '1';
    }
    showScreen('play');
  }

  function beginCountdown() {
    var seq = ['3', '2', '1', 'GO!'];
    var i = 0;
    function step() {
      if (i >= seq.length) {
        countdownEl.style.display = 'none';
        launchPlayback();
        return;
      }
      countdownNumEl.textContent = seq[i];
      countdownNumEl.className = 'sbg-cd-num sbg-pixel';
      void countdownNumEl.offsetWidth;
      countdownNumEl.classList.add('show');
      i++;
      setTimeout(step, i === seq.length ? 500 : 340);
    }
    countdownEl.style.display = 'flex';
    step();
  }

  function launchPlayback() {
    // 오디오는 여기서 바로 재생하지 않는다 — goAt을 기준으로 loop()가
    // 가상 시계를 굴리다가 LEAD_IN이 다 지나는 순간에 playAudio.play()를
    // 호출한다(위 LEAD_IN 주석 참고).
    goAt = performance.now();
    audioLaunched = false;
    rafId = requestAnimationFrame(loop);
  }

  function now() {
    if (audioLaunched) return playAudio ? playAudio.currentTime : 0;
    if (goAt === null) return 0;
    return (performance.now() - goAt) / 1000 - LEAD_IN;
  }

  // ------------------------------------------------------------ rendering
  function spawnNoteEl(note) {
    // 자기 레인 컨테이너 안에 노트를 붙여서(#sbg-board가 아니라), positionNote()
    // 에서 쓰는 %가 그 레인 자신의 길이(먼 쪽 끝 -> 허브 쪽 끝)를 기준으로
    // 계산되게 한다. #sbg-board에 바로 붙이면 travel=1이 보드 반대쪽 끝이
    // 되어버려 허브에서 멈추지 않는다.
    var laneEl = laneEls[note.lane];
    var el = document.createElement('div');
    el.className = 'sbg-note lane-' + note.lane;
    el.innerHTML = '<div class="sbg-cube"><div class="sbg-vf sbg-vf-front"></div><div class="sbg-vf sbg-vf-top"></div></div>';
    laneEl.appendChild(el);
    note.el = el;
  }

  function positionNote(note, progress) {
    var el = note.el;
    var p = clamp(progress, -0.05, 1.0);
    var travel = clamp(p, 0, 1);
    var pct = travel * 100 + '%';
    var scaleV = 0.4 + 0.85 * travel;
    var opacityV = 0.35 + 0.65 * travel;
    if (note.lane === 'w') { el.style.top = pct; el.style.left = '50%'; }
    else if (note.lane === 's') { el.style.bottom = pct; el.style.left = '50%'; }
    // lane-a's container occupies the board's LEFT half (its right edge sits
    // at board-center/the hub side), so `left` grows from the container's own
    // left edge (far/spawn) toward its right edge (near/hub) as travel -> 1.
    // lane-d's container occupies the RIGHT half (its left edge sits at the
    // hub side), so `right` grows from its right edge (far/spawn) toward its
    // left edge (near/hub) as travel -> 1. Using the wrong property for either
    // makes notes drift AWAY from the hub instead of converging on it
    // (caught via Playwright distance-to-hub measurement in 19차).
    else if (note.lane === 'a') { el.style.left = pct; el.style.top = '50%'; }
    else if (note.lane === 'd') { el.style.right = pct; el.style.top = '50%'; }
    el.firstChild.style.transform = 'translate(-50%,-50%) scale(' + scaleV.toFixed(3) + ')';
    el.style.setProperty('--sbg-fade', opacityV.toFixed(3));
  }

  function removeNote(note) {
    if (note.el && note.el.parentNode) { note.el.parentNode.removeChild(note.el); }
    note.el = null;
  }

  function popJudgeText(tier) {
    var el = document.createElement('div');
    el.className = 'sbg-judgetext ' + tier;
    el.textContent = tier === 'perfect' ? 'PERFECT' : tier === 'great' ? 'GREAT' : tier === 'good' ? 'GOOD' : 'MISS';
    boardEl.appendChild(el);
    void el.offsetWidth;
    el.classList.add('run');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 640);
    var color = tier === 'perfect' ? '#FFE9A8' : tier === 'great' ? '#4FD6E0' : tier === 'good' ? '#C9A6FF' : '#FF6FA0';
    hubFlashEl.style.background = 'radial-gradient(circle,' + color + ',transparent 70%)';
    hubFlashEl.classList.remove('on'); void hubFlashEl.offsetWidth; hubFlashEl.classList.add('on');
  }

  // 22차: HUD 좌측에 지금 이 판에 적용 중인 캐릭터 능력을 아이콘+이름으로
  // 보여주고, 콤보 방어/미스 세이브처럼 "남은 횟수"가 있는 능력은 그 횟수도
  // 같이 표시해서(예: "3/3") 플레이어가 몇 번 남았는지 실시간으로 알 수 있게 함.
  function renderCharHud() {
    var hud = root && root.querySelector('#sbg-char-hud');
    if (!hud) return;
    var c = getCharacter(activeCharacterKey);
    var extra = '';
    if (c.type === 'comboShield') extra = ' (' + runBuffs.comboShieldLeft + '/' + c.value + ')';
    else if (c.type === 'missSave') extra = ' (' + runBuffs.missSaveLeft + '/' + c.value + ')';
    hud.innerHTML = '<img src="' + c.icon + '" alt="' + c.name + '">' +
      '<span class="sbg-char-hud-text"><b>' + c.name + '</b> · ' + c.abilityName + extra + '</span>';
  }

  function addScore(tier) {
    var base = { perfect: 1000, great: 700, good: 400, miss: 0 }[tier];
    var mult = combo >= 50 ? 2 : combo >= 25 ? 1.5 : combo >= 10 ? 1.2 : 1;
    var c = getCharacter(activeCharacterKey);
    var charMult = c.type === 'scoreMult' ? c.value : 1;
    score += Math.round(base * mult * charMult);
    scoreEl.textContent = score;
  }

  function onHit(note, tier) {
    note.judged = true;
    var c = getCharacter(activeCharacterKey);

    // 22차 — 시월 "예능 치트키": 미스가 나면 남은 횟수만큼 GOOD으로 자동 전환.
    // 판정 자체가 바뀌는 것이라, 이후의 콤보/점수/통계는 전부 GOOD 기준으로
    // 정상 처리됨(도희의 콤보 방어와 달리 "미스였다"는 기록 자체가 안 남음).
    if (tier === 'miss' && c.type === 'missSave' && runBuffs.missSaveLeft > 0) {
      runBuffs.missSaveLeft--;
      tier = 'good';
      renderCharHud();
    }

    counts[tier]++;
    if (tier === 'miss') {
      // 22차 — 도희 "플로우 실드": 콤보 방어가 남아있으면 콤보를 0으로 리셋하지
      // 않고 그대로 유지(미스 자체는 통계에 그대로 기록됨 — 랭크/정확도에는
      // 여전히 영향을 줌, 콤보만 안 끊기는 절충).
      if (c.type === 'comboShield' && runBuffs.comboShieldLeft > 0) {
        runBuffs.comboShieldLeft--;
        renderCharHud();
      } else {
        combo = 0;
      }
    } else {
      combo++; if (combo > maxCombo) maxCombo = combo; addScore(tier);
    }
    comboEl.innerHTML = combo + '<span style="font-size:11px;"> combo</span>';
    popJudgeText(tier);
    removeNote(note);
  }

  function handleKey(lane) {
    if (!currentSong || !playScreen.classList.contains('is-active')) return;
    var t = now();
    // 22차 — 나리 "스테디 보이스": 판정 윈도우를 20% 넓혀서 PERFECT/GREAT/GOOD가
    // 전부 더 관대해지도록 함(윈도우 크기만 바뀌고, 판정 기준 시각 자체(note.t)나
    // 점수/랭크 계산식은 그대로).
    var c = getCharacter(activeCharacterKey);
    var winMult = c.type === 'windowBoost' ? c.value : 1;
    var wPerfect = WIN_PERFECT * winMult, wGreat = WIN_GREAT * winMult, wGood = WIN_GOOD * winMult;
    var best = null, bestDiff = Infinity;
    currentSong.notes.forEach(function (note) {
      if (note.judged || note.lane !== lane) return;
      var diff = Math.abs(t - note.t);
      if (diff <= wGood && diff < bestDiff) { best = note; bestDiff = diff; }
    });
    if (best) {
      var tier = bestDiff <= wPerfect ? 'perfect' : bestDiff <= wGreat ? 'great' : 'good';
      onHit(best, tier);
    }
  }

  function handleKeydown(e) {
    var lane = KEY_TO_LANE[e.code];
    if (!lane) return;
    if (!root || !root.classList.contains('is-open')) return; // 오버레이가 닫혀있으면 배경 스크롤 건드리지 않음
    e.preventDefault(); // 오버레이가 열려있는 동안은 W/A/S/D + 방향키를 항상 게임 전용으로 예약
    if (keytagEls[lane]) keytagEls[lane].classList.add('is-pressed');
    if (e.repeat) return;
    handleKey(lane);
  }
  function handleKeyup(e) {
    var lane = KEY_TO_LANE[e.code];
    if (lane && keytagEls[lane]) keytagEls[lane].classList.remove('is-pressed');
  }

  function loop() {
    if (!currentSong) return;
    // 가상 시계(now())가 리드인을 다 지나 0에 도달하는 순간, 그제서야 실제
    // 오디오 재생을 시작한다 — 이 순간부터 now()는 playAudio.currentTime을
    // 그대로 반환하도록 바뀌므로(위 now() 참고), 여기서 값이 튀지 않게
    // playAudio.currentTime을 0으로 맞춰준 뒤 넘어간다.
    if (!audioLaunched && now() >= 0) {
      audioLaunched = true;
      playAudio.currentTime = 0;
      playAudio.play().catch(function () {});
    }
    var t = now();
    var c = getCharacter(activeCharacterKey);
    // 22차 — 새벽 "디렉터스 아이": 노트의 실제 도착 시각(note.t, 판정 기준)은
    // 전혀 안 건드리고, 화면에서 노트가 이동하는 "체감 이동 시간"만 15% 늘려서
    // (=더 일찍 나타나고 더 천천히 다가오게) 반응할 시간을 더 준다.
    var travel = NOTE_TRAVEL * (c.type === 'slowNotes' ? c.value : 1);
    // 22차 — 나리 "스테디 보이스": 자동 미스 판정 기준도 넓어진 GOOD 윈도우에
    // 맞춰 같이 늦춰야, 넓어진 윈도우 안에서 키를 눌러도 그 전에 이미 자동
    // 미스 처리되는 모순이 생기지 않는다(handleKey의 wGood과 동일 계산).
    var missAt = WIN_GOOD * (c.type === 'windowBoost' ? c.value : 1);
    currentSong.notes.forEach(function (note) {
      if (note.judged) {
        if (note.el) removeNote(note);
        return;
      }
      var progress = 1 - (note.t - t) / travel;
      if (progress < -0.04) { return; }
      if (!note.el && progress <= 1.25) { spawnNoteEl(note); }
      if (note.el) { positionNote(note, progress); }
      if (t - note.t > missAt) {
        onHit(note, 'miss');
      }
    });
    var dur = currentSong.duration;
    var pct = clamp(t / dur, 0, 1) * 100;
    progressBar.style.width = pct + '%';
    if (t >= dur - 0.05 || (playAudio && playAudio.ended)) {
      if (!endedHandled) { endedHandled = true; setTimeout(showResults, 300); }
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopPlayback() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (playAudio) {
      try { playAudio.pause(); playAudio.currentTime = 0; } catch (e) {}
    }
    endedHandled = true;
    goAt = null;
    audioLaunched = false;
    var old = boardEl ? boardEl.querySelectorAll('.sbg-note, .sbg-judgetext') : [];
    Array.prototype.forEach.call(old, function (n) { n.remove(); });
  }

  function showResults() {
    if (rafId) cancelAnimationFrame(rafId);
    var total = counts.perfect + counts.great + counts.good + counts.miss;
    var acc = total > 0 ? (counts.perfect * 1 + counts.great * 0.7 + counts.good * 0.4) / total : 0;
    var rank = acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D';
    // 22-14차: "정확도가 낮게 나와서 다음 곡으로 넘어가기 힘들다"는 피드백 —
    // STAGE 1(blue_horizon)은 처음 만나는 튜토리얼 성격의 곡이라, 미스가
    // 많이 나서(10개 이상) 원래대로면 D가 나올 상황이어도 최소 C까지는
    // 보장해준다(체감 좌절감을 줄이는 용도). B 이상을 실제로 잘 받았다면
    // 이 보정으로 오히려 낮아지진 않도록 "바닥값"으로만 적용 — C보다 이미
    // 높은 랭크는 그대로 둔다.
    if (currentSong.song.key === 'blue_horizon' && counts.miss >= 10 && RANK_ORDER[rank] < RANK_ORDER.C) {
      rank = 'C';
    }
    resultsRankEl.textContent = rank;
    resultsRankEl.className = 'sbg-rank sbg-pixel ' + rank;
    // 22-10차: 정확도/콤보 숫자를 span으로 감싸서 .sbg-num(모노스페이스)를
    // 적용 — "Pixelify Sans"에서 5와 9가 똑같이 보이는 문제 때문에 96.8%를
    // 56.8%로 착각하는 등 랭크가 잘못됐다고 오해하는 걸 방지.
    resultsSongEl.innerHTML = currentSong.song.title + ' · 정확도 <span class="sbg-num">' + (acc * 100).toFixed(1) + '%</span> · 최대 콤보 <span class="sbg-num">' + maxCombo + '</span>';
    resultsScoreEl.textContent = score;

    // 21차: 지금 깬 곡이 현재 잠금 해제된 마지막 스테이지고, B랭크 이상이면
    // 다음 스테이지를 열어준다(순차 진행). 이미 더 앞서 열려 있던 스테이지를
    // 다시 플레이한 경우엔 진행도가 더 나아가지 않는다.
    var songIdx = SONGS.indexOf(currentSong.song);
    var unlockNoteEl = root.querySelector('#sbg-unlock-note');
    if (unlockNoteEl) {
      unlockNoteEl.className = 'sbg-unlock-note';
      unlockNoteEl.textContent = '';
    }
    if (songIdx === progress.unlockedIndex && RANK_ORDER[rank] >= RANK_ORDER[CLEAR_RANK]) {
      if (songIdx < SONGS.length - 1) {
        progress.unlockedIndex = songIdx + 1;
        saveProgress();
        renderSongGrid();
        if (unlockNoteEl) {
          unlockNoteEl.textContent = '🔓 STAGE ' + (songIdx + 2) + ' "' + SONGS[songIdx + 1].title + '" 해금!';
          unlockNoteEl.className = 'sbg-unlock-note is-shown';
        }
      } else if (unlockNoteEl) {
        unlockNoteEl.textContent = '🎉 모든 스테이지 클리어!';
        unlockNoteEl.className = 'sbg-unlock-note is-shown';
      }
    }

    resultsStatEl.innerHTML =
      '<div class="sbg-row perfect"><span>PERFECT</span><b>' + counts.perfect + '</b></div>' +
      '<div class="sbg-row great"><span>GREAT</span><b>' + counts.great + '</b></div>' +
      '<div class="sbg-row good"><span>GOOD</span><b>' + counts.good + '</b></div>' +
      '<div class="sbg-row miss"><span>MISS</span><b>' + counts.miss + '</b></div>';
    showScreen('results');
  }

  // -------------------------------------------------------------- public
  // 랜딩 페이지 전체가 window 스크롤 위치로 구동되는 scroll-scrubbed
  // 애니메이션이라(scrub-engine.js) 이 오버레이가 위에 떠 있는 동안 휠/트랙패드/
  // 방향키 스크롤이 배경 장면을 같이 끌고 갈 수 있다. 오버레이가 열려있는
  // 동안은 body 스크롤을 잠그고 닫힐 때 원래 상태로 복원한다.
  var savedBodyOverflow = null, savedHtmlOverflow = null;
  function blockWheel(e) { e.preventDefault(); }
  function lockPageScroll() {
    if (savedBodyOverflow === null) {
      savedBodyOverflow = document.body.style.overflow;
      savedHtmlOverflow = document.documentElement.style.overflow;
    }
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.addEventListener('wheel', blockWheel, { passive: false });
    window.addEventListener('touchmove', blockWheel, { passive: false });
  }
  function unlockPageScroll() {
    document.documentElement.style.overflow = savedHtmlOverflow || '';
    document.body.style.overflow = savedBodyOverflow || '';
    savedBodyOverflow = null;
    savedHtmlOverflow = null;
    window.removeEventListener('wheel', blockWheel, { passive: false });
    window.removeEventListener('touchmove', blockWheel, { passive: false });
  }

  function openOverlay() {
    if (!root) { injectFonts(); injectStyles(); buildDOM(); }
    root.classList.add('is-open');
    lockPageScroll();
    showScreen('select');
  }
  function closeOverlay() {
    stopPlayback();
    currentSong = null;
    if (root) root.classList.remove('is-open');
    unlockPageScroll();
  }

  window.SBGame = { open: openOverlay, close: closeOverlay };

  // 가벼운 디버그/테스트 훅 — 평소 플레이에는 영향 없음.
  window.__sbg = {
    getNotes: function () { return currentSong ? currentSong.notes.map(function (n) { return { time: n.t, lane: n.lane, judged: n.judged }; }) : []; },
    now: function () { return playAudio ? now() : null; },
    getScore: function () { return score; },
    getCombo: function () { return combo; },
    getCounts: function () { return counts; },
    getBpm: function () { return currentSong && BEATMAPS[currentSong.song.key] ? BEATMAPS[currentSong.song.key].bpm : null; },
    pressLane: function (lane) { handleKey(lane); },
    getActiveCharacter: function () { return activeCharacterKey; },
    getRunBuffs: function () { return runBuffs; },
    openCharSelect: function (songKey) { var s = SONGS.filter(function (x) { return x.key === songKey; })[0]; if (s) openCharSelect(s); }
  };
})();
