
window.onload = () => {
  const CH_STEREO = 2;
  const DEF_SAMPLE_RATE = 44100;
  // TODO : 何秒分？
  const DEF_LEN = 10000000;

  // オーディオ関連処理のコンテキスト（全体で1つのみ）
  let actxOff = new OfflineAudioContext(CH_STEREO, DEF_LEN, DEF_SAMPLE_RATE);
  // 動的なオーディオコンテキスト
  let actx = new AudioContext();

  let trackList = [];

  // DOM取得
  const panel = document.getElementsByClassName('audio-visual')[0];
  const curtain = document.getElementById('curtain');
  const wavCanvas = document.getElementById('wav-view');
  const freqCanvas = document.getElementById('freq-view');
  const fileInput = document.getElementById('wav-file');
  const playBtn = document.getElementById('play-btn');
  const trackElems = document.getElementsByClassName('audio-tracks')[0];

  /**
   * ファイルを読み込みます
   * @param {File} file Fileオブジェクト
   */
  const readFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = () => {
        resolve(reader.result);
      };
    });
  };

  /**
   * ArrayBuffer をデコードし AudioBuffer として返します
   * @param {ArrayBuffer} arrayBuffer 読み込みファイルの ArrayBuffer オブジェクト
   */
  const decode = (arrayBuffer) => {
    return new Promise((resolve, reject) => {
      actxOff.decodeAudioData(arrayBuffer).then((audioBuffer) => {
        resolve(audioBuffer);
      });
    });
  };

  /**
   * レンダリングの準備を行います
   * @param {Object} track トラックオブジェクト
   * @param {number} index インデックス
   */
  const preRender = (track, index) => {
    return new Promise((resolve, reject) => {
      if (!track.muted) {
        const src = actxOff.createBufferSource();
        src.buffer = track.buffer;
        src.connect(actxOff.destination);
        src.start();
      }
      resolve();
    });
  }

  const refreshTrackListPanel = (trackList) => {
    trackElems.textContent = '';
    trackList.forEach((track, idx) => {
      const fileElem = document.createElement('div');
      fileElem.setAttribute('data-idx', idx);
      fileElem.innerText = track.file.name;
      fileElem.classList.add('track');
      if (track.muted) {
        fileElem.classList.add('muted');
      }
      fileElem.onclick = (elem) => {
        const clickedIdx = elem.target.getAttribute('data-idx');
        trackList[clickedIdx].muted = !trackList[clickedIdx].muted;
        refreshTrackListPanel(trackList);
      }
      trackElems.appendChild(fileElem);
    });
  }

  const onSelectFile = (event) => {
    // 選択されたファイル一覧
    const files = Array.from(event.target.files);

    // すべてのファイルを読み込み、デコードする
    Promise.all(files.map(readFile)).then((bufs) => {
      curtain.style.display = 'block';
      Promise.all(bufs.map(decode)).then((abufs) => {
        console.log('デコード完了');
        curtain.style.display = 'none';
        audioBuffers = abufs;
        for (let i = 0; i < files.length; i++) {
          trackList.push({
            file: files[i],
            buffer: abufs[i],
            // デモのため先頭だけ非ミュートにする
            muted: (i != 0)
          });
        }
        // トラックリストの更新
        refreshTrackListPanel(trackList);
      });
    });
  };

  // ファイル選択時の処理
  fileInput.addEventListener('change', onSelectFile, false);

  let renderedBufferSource = null;

  // 再生ボタン押下時の処理
  playBtn.addEventListener('click', () => {
    // ミュート状態取得
    for (let i = 0; i < trackElems.children.length; i++) {
      trackList[i].muted = trackElems.children[i].classList.contains('muted');
    }

    if (renderedBufferSource != null) {
      // 停止
      renderedBufferSource.stop();
      renderedBufferSource = null;
      actx.close();
      playBtn.innerText = '再生';
    } else {
      // 再生
      actxOff = new OfflineAudioContext(CH_STEREO, DEF_LEN, DEF_SAMPLE_RATE);
      playBtn.innerText = '停止';
      Promise.all(trackList.map(preRender))
        .then(() => {
          // レンダリング開始
          return actxOff.startRendering();
        })
        .then((renderedBuffer) => {
          console.log('レンダリング完了');
          // レンダリング済みのバッファを利用し、今度は AudioContext を使って出力する
          actx = new AudioContext();
          const visualizer = new AudioVisualizer(actx);
          visualizer.drawWave(wavCanvas);
          visualizer.drawFreq(freqCanvas);
          renderedBufferSource = actx.createBufferSource();
          renderedBufferSource.buffer = renderedBuffer;
          renderedBufferSource.connect(actx.destination);
          renderedBufferSource.connect(visualizer.analyser);
          renderedBufferSource.start(0);
        });
    }
  });
};
