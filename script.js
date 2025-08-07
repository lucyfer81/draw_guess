document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('drawing-board');
  const ctx = canvas.getContext('2d');
  const clearBtn = document.getElementById('clear');
  const guessBtn = document.getElementById('guess');
  const categoryEl = document.getElementById('category');
  const wordsEl = document.getElementById('words');
  const resultEl = document.getElementById('result');
  
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let selectedWord = null;
  
  // 设置画布和工具
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000000';
  
  // 工具控制
  const toolPanel = document.getElementById('tools');
  const brushSize = document.getElementById('brush-size');
  const colorPicker = document.getElementById('color-picker');
  const eraserBtn = document.getElementById('eraser');
  const hintBtn = document.getElementById('hint');
  
  // 更新画笔大小
  brushSize.addEventListener('input', () => {
    ctx.lineWidth = brushSize.value;
  });
  
  // 更新颜色
  colorPicker.addEventListener('input', () => {
    ctx.strokeStyle = colorPicker.value;
    eraserBtn.classList.remove('active');
  });
  
  // 橡皮擦
  eraserBtn.addEventListener('click', () => {
    ctx.strokeStyle = '#ffffff';
    eraserBtn.classList.add('active');
  });
  
  // 提示
  hintBtn.addEventListener('click', () => {
    if (!selectedWord) return;
    resultEl.innerHTML = `
      <div class="hint">
        <p>提示: ${selectedWord}</p>
        <img src="/api/hint?word=${encodeURIComponent(selectedWord)}" 
             alt="示例图片" style="max-width: 200px; max-height: 200px;">
      </div>
    `;
  });
  
  // 获取新游戏
  async function newGame() {
    resultEl.innerHTML = '';
    wordsEl.innerHTML = '<div class="loading"><div class="spinner"></div>正在加载新游戏...</div>';
    
    try {
      const response = await fetch('/api/new-game');
      const data = await response.json();
      
      categoryEl.textContent = `类别: ${getCategoryName(data.category)}`;
      wordsEl.innerHTML = data.words.map(word => 
        `<span class="word" data-word="${word}">${word}</span>`
      ).join(' ');
      
      // 重置画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      guessBtn.disabled = true;
      
      // 设置提示词点击事件
      document.querySelectorAll('.word').forEach(wordEl => {
        wordEl.addEventListener('click', () => {
          selectedWord = wordEl.dataset.word;
          document.querySelectorAll('.word').forEach(w => {
            w.style.fontWeight = 'normal';
            w.style.backgroundColor = '#e9ecef';
          });
          wordEl.style.fontWeight = 'bold';
          wordEl.style.backgroundColor = '#d4d4d4';
          guessBtn.disabled = false;
        });
      });
    } catch (error) {
      wordsEl.innerHTML = `<p style="color: #dc3545">加载游戏错误: ${error.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }
  }
  
  // 绘画功能
  function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
  }
  
  function draw(e) {
    if (!isDrawing) return;
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    
    [lastX, lastY] = [e.offsetX, e.offsetY];
  }
  
  function stopDrawing() {
    isDrawing = false;
  }
  
  // 检测绘画质量
  function checkDrawingQuality() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let nonWhitePixels = 0;
    let totalIntensity = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const intensity = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (intensity < 250) {
        nonWhitePixels++;
        totalIntensity += intensity;
      }
    }
    
    const coverage = nonWhitePixels / (canvas.width * canvas.height);
    const avgIntensity = nonWhitePixels > 0 ? totalIntensity / nonWhitePixels : 255;
    
    return {
      coverage: coverage,
      isEmpty: coverage < 0.01,
      isTooSparse: coverage < 0.05,
      isTooDark: avgIntensity < 100,
      quality: coverage > 0.05 && coverage < 0.8 && avgIntensity > 50 ? 'good' : 'poor'
    };
  }

  // 增强图像预处理
  function enhanceImageData(sourceCanvas) {
    const enhancedCanvas = document.createElement('canvas');
    enhancedCanvas.width = 224;
    enhancedCanvas.height = 224;
    const enhancedCtx = enhancedCanvas.getContext('2d');
    
    enhancedCtx.fillStyle = "white";
    enhancedCtx.fillRect(0, 0, 224, 224);
    enhancedCtx.drawImage(sourceCanvas, 0, 0, 224, 224);
    
    const imageData = enhancedCtx.getImageData(0, 0, 224, 224);
    const data = imageData.data;
    
    // 增强对比度和线条
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      
      let enhanced = gray;
      if (gray < 128) {
        enhanced = Math.max(0, gray - 50);
      } else {
        enhanced = Math.min(255, gray + 50);
      }
      
      const threshold = 100;
      if (Math.abs(gray - 255) < threshold) {
        enhanced = 255;
      } else {
        enhanced = Math.max(0, enhanced - 30);
      }
      
      data[i] = data[i + 1] = data[i + 2] = enhanced;
      data[i + 3] = 255;
    }
    
    enhancedCtx.putImageData(imageData, 0, 0);
    return enhancedCanvas;
  }

  // 清除画布
  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    selectedWord = null;
    document.querySelectorAll('.word').forEach(w => {
        w.style.fontWeight = 'normal';
        w.style.backgroundColor = '#e9ecef';
    });
    guessBtn.disabled = true;
  }
  
  // 提交猜测
  async function makeGuess() {
    if (!selectedWord) return;
    
    // 检查绘画质量
    const quality = checkDrawingQuality();
    if (quality.isEmpty) {
      resultEl.innerHTML = `
        <div style="color: #ff9800; padding: 20px; border: 1px solid #ff9800; border-radius: 8px; margin: 10px 0;">
          <h4>⚠️ 画布为空</h4>
          <p>请先画点什么再让AI猜测！</p>
        </div>
      `;
      return;
    }
    
    if (quality.isTooSparse) {
      resultEl.innerHTML = `
        <div style="color: #ff9800; padding: 20px; border: 1px solid #ff9800; border-radius: 8px; margin: 10px 0;">
          <h4>⚠️ 绘画太简单</h4>
          <p>画面内容太少，AI可能无法准确识别。尝试添加更多细节！</p>
          <button onclick="this.parentElement.parentElement.innerHTML=''" style="margin-top: 10px;">继续绘画</button>
        </div>
      `;
      return;
    }
    
    // 显示加载状态
    resultEl.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>AI正在分析你的画作 (质量: ${quality.quality === 'good' ? '良好' : '待改进'})...</p>
      </div>
    `;
    
    // 高分辨率处理
    const highResCanvas = document.createElement('canvas');
    highResCanvas.width = 800;
    highResCanvas.height = 800;
    const highResCtx = highResCanvas.getContext('2d');
    highResCtx.fillStyle = "white";
    highResCtx.fillRect(0, 0, 800, 800);
    highResCtx.imageSmoothingEnabled = false;
    highResCtx.drawImage(canvas, 0, 0, 800, 800);
    
    // 使用增强图像预处理
    const enhancedCanvas = enhanceImageData(highResCanvas);
    const imageData = enhancedCanvas.toDataURL('image/png', 1.0);
    
    // 获取所有提示词和选中词
    const words = Array.from(wordsEl.querySelectorAll('.word'))
      .map(el => el.textContent);
    const selectedWords = selectedWord ? [selectedWord] : [];
    
    try {
      const response = await fetch('/api/guess', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image: imageData,
            words: words,
            selectedWords: selectedWords,
            drawingSettings: {
                lineWidth: ctx.lineWidth,
                lineColor: ctx.strokeStyle
            }
        })
      });
      
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'An unknown error occurred.');
      }

      const result = await response.json();
      
      // 显示结果
      const isCorrect = result.guess.toLowerCase() === selectedWord.toLowerCase();
      const emoji = isCorrect ? '🎉' : '😅';
      
      resultEl.innerHTML = `
        <h3>${emoji} 结果 ${emoji}</h3>
        <p>你画的是: <strong>${selectedWord}</strong></p>
        <p>AI猜的是: <strong>${result.guess}</strong></p>
        <p>置信度: <strong>${(result.confidence * 100).toFixed(1)}%</strong></p>
        <p style="font-weight: bold; color: ${isCorrect ? '#28a745' : '#dc3545'}">
          ${isCorrect ? '正确！' : '不太对...'}
        </p>
        <button id="play-again">再玩一次</button>
      `;
      
      document.getElementById('play-again').addEventListener('click', newGame);
    } catch (error) {
      resultEl.innerHTML = `
        <p style="color: #dc3545">错误: ${error.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <button id="try-again">重试</button>
      `;
      document.getElementById('try-again').addEventListener('click', makeGuess);
    }
  }
  
  // 事件监听器
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  // 触摸设备支持
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    startDrawing({
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top
    });
  });
  
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    draw({
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top
    });
  });
  
  canvas.addEventListener('touchend', stopDrawing);
  
  clearBtn.addEventListener('click', clearCanvas);
  guessBtn.addEventListener('click', makeGuess);
  
  // 开始新游戏
  newGame();
  
  function getCategoryName(category) {
    const categoryNames = {
      'animals': '动物',
      'food': '食物', 
      'movies': '电影',
      'countries': '国家',
      'vehicles': '交通工具',
      'famous-people': '名人',
      'sports': '运动',
      'musical-instruments': '乐器'
    };
    return categoryNames[category] || category;
  }
  
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
});
