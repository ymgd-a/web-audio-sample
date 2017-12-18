/**
 * シンプルなDAWの機能を提供するクラスです
 */
class Daw {

  /**
   * コンストラクタです
   */
  constructor() {
    // 内部処理チャンネル数
    this.numsCh = 2;
    // 内部処理サンプルレート
    this.sampleRate = 44100;
    // 処理可能な秒数（１分とする）
    this.limitSec = 60;
    // 内部処理バッファサイズ
    this.bufferLen = this.sampleRate * this.limitSec;
    // 静的なオーディオコンテキスト
    this.ctxOff = new OfflineAudioContext(this.numsCh, this.bufferLen, this.sampleRate);
    // 動的なオーディオコンテキスト
    this.ctx = new AudioContext();
    // トラック情報一覧
    this.trackList = [];
    // レンダリング済みバッファ
    this.renderedBufferSource = null;
    // DOM
    this.dom = {
      curtain: document.getElementById('curtain'),
      wavCanvas: document.getElementById('wav-view'),
      freqCanvas: document.getElementById('freq-view'),
      fileInput: document.getElementById('wav-file'),
      playBtn: document.getElementById('play-btn'),
      trackElem: document.getElementsByClassName('audio-tracks')[0]
    };
    
    // イベントをハンドル
    this.handle();
  }

  /**
   * イベントをハンドルします
   */
  handle() {
    // ファイル選択時
    this.dom.fileInput.addEventListener('change', (ev) => {
      this.onSelectFile(ev)
    });
    // 再生ボタン押下時の処理
    this.dom.playBtn.addEventListener('click', (ev) => {
      this.onClickPlay(ev);
    });
  }

  /**
   * ファイルを読み込みます
   * @param {File} file Fileオブジェクト
   */
  readFile(file) {
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
  decode(arrayBuffer) {
    return new Promise((resolve, reject) => {
      this.ctxOff.decodeAudioData(arrayBuffer).then((audioBuffer) => {
        resolve(audioBuffer);
      });
    });
  };

  /**
   * レンダリングの準備を行います
   * @param {Object} track トラック情報オブジェクト
   * @param {number} index トラック情報オブジェクトのインデックス
   */
  setupRender(track, index) {
    return new Promise((resolve, reject) => {
      if (!track.muted) {
        const src = this.ctxOff.createBufferSource();
        src.buffer = track.buffer;
        src.connect(this.ctxOff.destination);
        src.start();
      }
      resolve();
    });
  }

  /**
   * トラックリスト一覧を更新します
   * @param {Array} trackList トラック情報一覧
   */
  refreshTrackListPanel(trackList) {
    this.dom.trackElem.textContent = '';
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
        this.refreshTrackListPanel(trackList);
      }
      this.dom.trackElem.appendChild(fileElem);
    });
  }

  /**
   * ファイル選択時の処理です
   * @param {Event} event イベントオブジェクト
   */
  onSelectFile(event) {
    // 選択されたファイル一覧を取得
    const files = Array.from(event.target.files);
    if (files.length == 0) {
      return;
    }

    // トラックリストを空にする
    this.trackList = [];

    // すべてのファイルを読み込み、デコード
    Promise.all(files.map(this.readFile, this)).then((bufs) => {
      this.dom.curtain.style.display = 'block';
      Promise.all(bufs.map(this.decode, this)).then((abufs) => {
        this.dom.curtain.style.display = 'none';
        // デコードしたすべてのファイルからトラック情報の一覧を作成
        for (let i = 0; i < files.length; i++) {
          this.trackList.push({
            file: files[i],
            buffer: abufs[i],
            // デモのため先頭だけ非ミュート
            muted: (i != 0)
          });
        }
        // トラックリストの更新
        this.refreshTrackListPanel(this.trackList);
      });
    });
  };

  /**
   * 再生ボタン押下時の処理です
   */
  onClickPlay() {
    // ミュート状態取得
    for (let i = 0; i < this.dom.trackElem.children.length; i++) {
      this.trackList[i].muted = this.dom.trackElem.children[i].classList.contains('muted');
    }

    if (this.renderedBufferSource != null) {
      // 停止
      this.renderedBufferSource.stop();
      this.renderedBufferSource = null;
      this.ctx.close();
      this.dom.playBtn.innerText = '再生';
    } else {
      // 再生
      this.ctxOff = new OfflineAudioContext(this.numsCh, this.bufferLen, this.sampleRate);
      this.dom.playBtn.innerText = '停止';
      Promise.all(this.trackList.map(this.setupRender, this))
        .then(() => {
          // レンダリング開始
          return this.ctxOff.startRendering();
        })
        .then((renderedBuffer) => {
          // レンダリング済みのバッファを利用し、動的な AudioContext を使って出力
          this.ctx = new AudioContext();

          // ビジュアライザ生成＆描画処理実行
          const visualizer = new AudioVisualizer(this.ctx);
          visualizer.drawWave(this.dom.wavCanvas);
          visualizer.drawFreq(this.dom.freqCanvas);

          // レンダリング済みバッファをスピーカーとビジュアライザへ接続
          this.renderedBufferSource = this.ctx.createBufferSource();
          this.renderedBufferSource.buffer = renderedBuffer;
          this.renderedBufferSource.connect(this.ctx.destination);
          this.renderedBufferSource.connect(visualizer.analyser);

          // ミックスした音声を再生
          this.renderedBufferSource.start(0);
        });
    }
  }
}
