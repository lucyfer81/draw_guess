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
  
  // 设置画布
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000000';
  
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
    
    // 显示加载状态
    resultEl.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>AI正在分析你的画作...</p>
      </div>
    `;
    
    // 将画布缩小到适合CLIP模型的尺寸
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 224;
    tempCanvas.height = 224;
    const tempCtx = tempCanvas.getContext('2d');
    // Add a white background to the temp canvas
    tempCtx.fillStyle = "white";
    tempCtx.fillRect(0, 0, 224, 224);
    tempCtx.drawImage(canvas, 0, 0, 224, 224);
    const imageData = tempCanvas.toDataURL('image/png');
    
    // 获取提示词
    const words = Array.from(wordsEl.querySelectorAll('.word'))
      .map(el => el.textContent);
    
    try {
      const response = await fetch('/api/guess', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image: imageData,
            words: words
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