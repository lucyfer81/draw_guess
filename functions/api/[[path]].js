// 简化的 guess 端点 - 使用模拟 AI 响应
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const route = context.params.path.join('/');

    if (route === 'test' && request.method === 'GET') {
        return new Response(JSON.stringify({
            message: "Functions are working!",
            env: {
                hasAccountId: !!env.ACCOUNT_ID,
                hasAiToken: !!env.AI_TOKEN
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (route === 'new-game' && request.method === 'GET') {
        return handleNewGame();
    }

    // Route for handling the guess
    if (route === 'guess' && request.method === 'POST') {
        return handleRealGuess(request, env);
    }

    return new Response('API route not found', { status: 404 });
}

async function handleRealGuess(request, env) {
    try {
        // 使用 tee() 方法来避免重复读取请求体
        const clonedRequest = request.clone();
        const { image, words } = await clonedRequest.json();

        if (!image || !words || !Array.isArray(words) || words.length === 0) {
            return new Response(JSON.stringify({ error: '无效请求：需要图片和单词。' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // 检查是否有 AI_TOKEN
        if (!env.AI_TOKEN) {
            // 如果没有 AI_TOKEN，使用模拟响应
            return handleGuessMock(request, env);
        }
        
        // 将 base64 图片转换为 blob
        const imageResponse = await fetch(image);
        const imageBlob = await imageResponse.blob();
        const imageBytes = [...new Uint8Array(await imageBlob.arrayBuffer())];
        
        // 使用 Cloudflare Workers AI REST API
        const accountId = env.ACCOUNT_ID;
        const aiResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/microsoft/resnet-50`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.AI_TOKEN}`
            },
            body: JSON.stringify({
                image: imageBytes,
                labels: words
            })
        });
        
        if (!aiResponse.ok) {
            throw new Error('AI API 调用失败');
        }
        
        const aiResult = await aiResponse.json();
        
        if (!aiResult.success || !aiResult.result || aiResult.result.length === 0) {
            throw new Error('AI模型未返回有效结果');
        }
        
        // 获取最佳匹配结果
        const bestGuess = aiResult.result[0];
        
        return new Response(JSON.stringify({ 
            guess: bestGuess.label, 
            confidence: bestGuess.score 
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
        
    } catch (error) {
        console.error('AI API Error:', error);
        // 如果 AI 调用失败，回退到模拟响应
        return handleGuessMock(request, env);
    }
}

function handleNewGame() {
    const wordBank = {
        animals: ['猫', '狗', '鸟', '鱼', '大象', '狮子', '老虎', '熊', '蛇', '兔子', '猴子', '长颈鹿'],
        food: ['苹果', '香蕉', '披萨', '汉堡', '寿司', '冰淇淋', '蛋糕', '意大利面', '巧克力', '咖啡'],
        movies: ['泰坦尼克号', '盗梦空间', '阿凡达', '黑客帝国', '星球大战', '教父', '侏罗纪公园', '狮子王'],
        countries: ['美国', '中国', '日本', '法国', '巴西', '澳大利亚', '加拿大', '墨西哥', '意大利', '德国'],
        vehicles: ['汽车', '公交车', '自行车', '飞机', '船', '火车', '摩托车', '直升机', '卡车'],
        'famous-people': ['爱因斯坦', '玛丽莲·梦露', '猫王', '莎士比亚', '曼德拉', '迈克尔·杰克逊', '麦当娜'],
        sports: ['足球', '篮球', '网球', '高尔夫', '游泳', '自行车', '拳击', '排球'],
        'musical-instruments': ['吉他', '钢琴', '小提琴', '鼓', '长笛', '小号', '萨克斯', '竖琴']
    };

    function shuffle(array) {
        return [...array].sort(() => Math.random() - 0.5);
    }

    function getRandomCategory() {
        const categories = Object.keys(wordBank);
        return categories[Math.floor(Math.random() * categories.length)];
    }

    function getRandomWords(category, count) {
        const words = wordBank[category] || wordBank.animals;
        return shuffle(words).slice(0, count);
    }

    const category = getRandomCategory();
    const words = getRandomWords(category, 4);
    return Response.json({ category, words });
}

async function handleGuessMock(request, env) {
    try {
        const { image: imageData, words } = await request.json();

        if (!imageData || !words || !Array.isArray(words) || words.length === 0) {
            return Response.json({ error: '无效的请求内容' }, { status: 400 });
        }
        
        // 模拟 AI 响应 - 随机选择一个单词
        const randomIndex = Math.floor(Math.random() * words.length);
        const guess = words[randomIndex];
        const confidence = 0.7 + Math.random() * 0.3; // 0.7-1.0
        
        return Response.json({ 
          guess, 
          confidence,
          allResults: words.map((word, i) => ({ word, score: i === randomIndex ? confidence : Math.random() * 0.5 }))
        });

      } catch (error) {
        console.error(error.stack);
        return Response.json({ error: error.message }, {
          status: 500
        });
      }
}