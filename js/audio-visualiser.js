/**
 * オーディオビジュアライザを実装したクラスです
 */
class AudioVisualizer {
  
  /**
   * コンストラクタです
   * @param {AudioContext} audioContext 解析対象の AudioContext オブジェクト
   */
  constructor(audioContext) {
    // コンテキスト
    this.audioContext = audioContext;
    // リアルタイム分析のバッファサイズ
    this.bufferLen = 2048;
    // アナライザ
    this.analyser = audioContext.createAnalyser();
    // FFTサイズ
    this.analyser.fftSize = this.bufferLen;
  }

  /**
   * 波形を描画します
   * @param {HTMLCanvasElement} canvas キャンバス要素
   */
  drawWave(canvas) {
    const ctx = canvas.getContext('2d');
    this._drawWave(canvas, ctx);
  }

  /**
   * 周波数帯域ごとの強弱を表すグラフ（スペクトラムアナライザ）を描画します
   * @param {HTMLCanvasElement} canvas キャンバス要素
   */
  drawFreq(canvas) {
    const ctx = canvas.getContext('2d');
    this._drawFreq(canvas, ctx);
  }

  /**
   * 波形を描画します（内部処理）
   * @param {HTMLCanvasElement} canvas キャンバス要素
   * @param {CanvasRenderingContext2D} ctx Canvasのコンテキスト
   */
  _drawWave(canvas, ctx) {
    this._adjustCanvasSize(canvas);
    this.audioContext.create
    // 環境によって描画レートに差を生じさせないためのコールバック設定
    requestAnimationFrame(() => {
      this._drawWave(canvas, ctx);
    });

    // 分析済みデータを格納する配列（符号なし8ビット）
    const analysedData = new Uint8Array(this.bufferLen);

    // 分析実行
    this.analyser.getByteTimeDomainData(analysedData);
    
    // 背景描画
    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);

    // 波形描画
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#48f';
    ctx.beginPath();

    const widthPerSample = width / this.bufferLen;
    let x = 0;
    for (let i = 0; i < this.bufferLen; i++) {
      // 座標を算出する
      const level = analysedData[i] / 128;
      const y = level * height / 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += widthPerSample;
    }

    // 波形を描画
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  
  /**
   * 周波数帯域ごとの強弱を表すグラフ（スペクトラムアナライザ）を描画します（内部処理）
   * @param {HTMLCanvasElement} canvas キャンバス要素
   * @param {CanvasRenderingContext2D} ctx Canvasのコンテキスト
   */
  _drawFreq(canvas, ctx) {
    this._adjustCanvasSize(canvas);
    
    // 環境によって描画レートに差を生じさせないためのコールバック設定
    requestAnimationFrame(() => {
      this._drawFreq(canvas, ctx);
    });

    // 分析済みデータを格納する配列（符号なし8ビット）
    const analysedData = new Uint8Array(this.bufferLen);

    // 周波数帯域の分析を実行
    this.analyser.getByteFrequencyData(analysedData);

    // 背景描画
    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);

    // バーのスタイル
    const margin = 1;
    const barWidth = 4;
    ctx.fillStyle = 'orangered';

    // 周波数上限値とそのインデックス
    const freqMax = 20500;
    const freqMaxIdx = (freqMax * this.bufferLen) / this.audioContext.sampleRate;

    // 取得したデータの内、画面表示用に必要なデータ数
    const numsSample = Math.ceil(width / (margin + barWidth));
    // 間引く間隔
    const step = Math.ceil(freqMaxIdx / numsSample);

    let x = 0;
    const measures = [0, 1000, 2000, 5000, 10000, 20000];
    for (let i = 0; i < freqMaxIdx; i += step) {
      // 現在の周波数を求める
      const freq = i * this.audioContext.sampleRate / this.bufferLen;
      // 目盛り描画
      if (freq > measures[0]) {
        measures.shift();
        ctx.fillText(Math.floor(freq / 1000) + "kHz", x, 10);
      }

      // バー描画
      const barHeight = (analysedData[i] / 255) * height;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      x += barWidth + margin;
    }
  }

  /**
   * キャンバスサイズの調整をします
   * @param {HTMLCanvasElement} canvas キャンバス要素
   */
  _adjustCanvasSize(canvas) {
    const width  = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width != width || canvas.height != height) {
      canvas.width  = width;
      canvas.height = height;
    }
  }
}
