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
            return handleGuessMock(request, env);
        }
        
        // 将 base64 图片转换为 blob
        const imageResponse = await fetch(image);
        const imageBlob = await imageResponse.blob();
        const imageBytes = [...new Uint8Array(await imageBlob.arrayBuffer())];
        
        const accountId = env.ACCOUNT_ID;
        
        // 使用更适合简笔画识别的模型组合
        const [imageClassification, objectDetection, clipModel] = await Promise.all([
            // 1. 改进的图像分类模型 - 更适合简笔画识别
            fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/microsoft/resnet-50`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.AI_TOKEN}`
                },
                body: JSON.stringify({
                    image: imageBytes
                })
            }).catch(() => null),
            // 2. 物体检测模型 - 提供更详细的识别
            fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/facebook/detr-resnet-50`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.AI_TOKEN}`
                },
                body: JSON.stringify({
                    image: imageBytes
                })
            }).catch(() => null),
            // 3. CLIP模型 - 用于文本-图像匹配（如果可用）
            fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/openai/clip`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.AI_TOKEN}`
                },
                body: JSON.stringify({
                    image: imageBytes,
                    text: words
                })
            }).catch(() => null)
        ]);

        // 获取所有模型的识别结果
        const results = await Promise.all([
            imageClassification ? imageClassification.json() : Promise.resolve(null),
            objectDetection ? objectDetection.json() : Promise.resolve(null),
            clipModel ? clipModel.json() : Promise.resolve(null)
        ]);
        
        const [classificationResult, detectionResult, clipResult] = results;

        // 提取所有可能的识别结果
        const allPredictions = [];
        
        // 从分类结果中提取
        if (classificationResult.result && Array.isArray(classificationResult.result)) {
            classificationResult.result.forEach(item => {
                if (item.label) {
                    allPredictions.push({
                        label: item.label.toLowerCase(),
                        confidence: item.score || item.confidence || 0.5,
                        source: 'classification'
                    });
                }
            });
        }

        // 中英文词汇映射表
        const chineseToEnglish = {
            '猫': 'cat', '狗': 'dog', '鸟': 'bird', '鱼': 'fish', '大象': 'elephant',
            '狮子': 'lion', '老虎': 'tiger', '熊': 'bear', '蛇': 'snake', '兔子': 'rabbit',
            '猴子': 'monkey', '长颈鹿': 'giraffe', '苹果': 'apple', '香蕉': 'banana',
            '披萨': 'pizza', '汉堡': 'hamburger', '寿司': 'sushi', '冰淇淋': 'ice cream',
            '蛋糕': 'cake', '意大利面': 'pasta', '巧克力': 'chocolate', '咖啡': 'coffee',
            '汽车': 'car', '公交车': 'bus', '自行车': 'bicycle', '飞机': 'airplane',
            '船': 'boat', '火车': 'train', '摩托车': 'motorcycle', '直升机': 'helicopter',
            '卡车': 'truck', '吉他': 'guitar', '钢琴': 'piano', '小提琴': 'violin',
            '鼓': 'drum', '长笛': 'flute', '小号': 'trumpet', '萨克斯': 'saxophone',
            '足球': 'soccer ball', '篮球': 'basketball', '网球': 'tennis ball',
            '高尔夫': 'golf', '游泳': 'swimming', '拳击': 'boxing', '排球': 'volleyball',
            '美国': 'america', '中国': 'china', '日本': 'japan', '法国': 'france',
            '巴西': 'brazil', '澳大利亚': 'australia', '加拿大': 'canada', '墨西哥': 'mexico',
            '意大利': 'italy', '德国': 'germany', '泰坦尼克号': 'titanic', '盗梦空间': 'inception',
            '阿凡达': 'avatar', '黑客帝国': 'matrix', '星球大战': 'star wars', '教父': 'godfather',
            '侏罗纪公园': 'jurassic park', '狮子王': 'lion king', '爱因斯坦': 'einstein',
            '玛丽莲·梦露': 'marilyn monroe', '猫王': 'elvis presley', '莎士比亚': 'shakespeare',
            '曼德拉': 'mandela', '迈克尔·杰克逊': 'michael jackson', '麦当娜': 'madonna'
        };

        // 从检测结果中提取
        if (detectionResult && detectionResult.result && Array.isArray(detectionResult.result)) {
            detectionResult.result.forEach(item => {
                if (item.label) {
                    allPredictions.push({
                        label: item.label.toLowerCase(),
                        confidence: item.confidence || item.score || 0.5,
                        source: 'detection'
                    });
                }
            });
        }

        // 从CLIP结果中提取
        if (clipResult && clipResult.result && Array.isArray(clipResult.result)) {
            clipResult.result.forEach((item, index) => {
                if (words[index]) {
                    allPredictions.push({
                        label: words[index].toLowerCase(),
                        confidence: item.score || 0.7,
                        source: 'clip'
                    });
                }
            });
        }

        // 如果所有模型都没有返回结果，使用模拟分类
        if (allPredictions.length === 0) {
            return handleGuessMock(request, env);
        }

        // 计算每个候选单词的匹配得分 - 使用改进的中文匹配算法
        const wordScores = words.map(candidateWord => {
            const candidate = candidateWord.toLowerCase();
            const candidateEn = chineseToEnglish[candidate] || candidate;
            let maxScore = 0;
            let bestMatch = '';
            
            allPredictions.forEach(prediction => {
                const label = prediction.label.toLowerCase();
                let similarity = 0;
                
                // 直接中文匹配
                if (label === candidate) {
                    similarity = 1.0;
                    bestMatch = label;
                }
                // 英文映射匹配
                else if (candidateEn && label.includes(candidateEn)) {
                    similarity = 0.9;
                    bestMatch = label;
                }
                else if (candidateEn && candidateEn.includes(label)) {
                    similarity = 0.85;
                    bestMatch = label;
                }
                // 语义相似度匹配
                else {
                    // 计算词级别的相似度
                    const labelWords = label.split(/[\s-_]+/);
                    const candidateWords = candidateEn.split(/[\s-_]+/);
                    
                    let wordMatches = 0;
                    candidateWords.forEach(cw => {
                        labelWords.forEach(lw => {
                            if (cw.length > 2 && lw.length > 2) {
                                if (cw === lw) wordMatches += 1.0;
                                else if (cw.includes(lw) || lw.includes(cw)) wordMatches += 0.7;
                            }
                        });
                    });
                    
                    similarity = wordMatches / Math.max(candidateWords.length, labelWords.length);
                    if (similarity > 0) bestMatch = label;
                }
                
                // 增强的置信度计算
                let modelWeight = 1.0;
                switch(prediction.source) {
                    case 'clip': modelWeight = 1.5; break;
                    case 'classification': modelWeight = 1.2; break;
                    case 'detection': modelWeight = 1.0; break;
                }
                
                const score = similarity * prediction.confidence * modelWeight;
                
                if (score > maxScore) {
                    maxScore = score;
                }
            });
            
            return {
                word: candidateWord,
                score: Math.min(maxScore, 0.95),
                confidence: Math.min(maxScore, 0.95),
                bestMatch: bestMatch
            };
        });

        // 按得分排序
        wordScores.sort((a, b) => b.score - a.score);
        
        const bestGuess = wordScores[0].word;
        const confidence = Math.min(wordScores[0].confidence, 0.95);

        // 添加调试信息
        const debugInfo = {
            allPredictions: allPredictions.slice(0, 5), // 只返回前5个预测
            wordScores: wordScores.slice(0, 3),
            modelResults: {
                classification: classificationResult.result ? 'success' : 'failed',
                detection: detectionResult.result ? 'success' : 'failed'
            }
        };

        return new Response(JSON.stringify({ 
            guess: bestGuess,
            confidence: confidence,
            debug: debugInfo
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
        
    } catch (error) {
        console.error('AI API Error:', error);
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
        
        // 中英文词汇映射表（模拟版本）
        const chineseToEnglish = {
            '猫': 'cat', '狗': 'dog', '鸟': 'bird', '鱼': 'fish', '大象': 'elephant',
            '狮子': 'lion', '老虎': 'tiger', '熊': 'bear', '蛇': 'snake', '兔子': 'rabbit',
            '猴子': 'monkey', '长颈鹿': 'giraffe', '苹果': 'apple', '香蕉': 'banana',
            '披萨': 'pizza', '汉堡': 'hamburger', '寿司': 'sushi', '冰淇淋': 'ice cream',
            '蛋糕': 'cake', '意大利面': 'pasta', '巧克力': 'chocolate', '咖啡': 'coffee',
            '汽车': 'car', '公交车': 'bus', '自行车': 'bicycle', '飞机': 'airplane',
            '船': 'boat', '火车': 'train', '摩托车': 'motorcycle', '直升机': 'helicopter',
            '卡车': 'truck', '吉他': 'guitar', '钢琴': 'piano', '小提琴': 'violin',
            '鼓': 'drum', '长笛': 'flute', '小号': 'trumpet', '萨克斯': 'saxophone',
            '足球': 'soccer ball', '篮球': 'basketball', '网球': 'tennis ball',
            '高尔夫': 'golf', '游泳': 'swimming', '拳击': 'boxing', '排球': 'volleyball',
            '美国': 'america', '中国': 'china', '日本': 'japan', '法国': 'france',
            '巴西': 'brazil', '澳大利亚': 'australia', '加拿大': 'canada', '墨西哥': 'mexico',
            '意大利': 'italy', '德国': 'germany', '泰坦尼克号': 'titanic', '盗梦空间': 'inception',
            '阿凡达': 'avatar', '黑客帝国': 'matrix', '星球大战': 'star wars', '教父': 'godfather',
            '侏罗纪公园': 'jurassic park', '狮子王': 'lion king', '爱因斯坦': 'einstein',
            '玛丽莲·梦露': 'marilyn monroe', '猫王': 'elvis presley', '莎士比亚': 'shakespeare',
            '曼德拉': 'mandela', '迈克尔·杰克逊': 'michael jackson', '麦当娜': 'madonna'
        };

        // 改进的模拟 AI 响应 - 基于更智能的匹配逻辑
        const mockPredictions = [
            'cat', 'dog', 'bird', 'fish', 'elephant', 'lion', 'tiger', 'bear', 'giraffe', 'rabbit',
            'monkey', 'snake', 'apple', 'banana', 'pizza', 'hamburger', 'sushi', 'cake', 'pasta',
            'ice cream', 'car', 'bus', 'bicycle', 'airplane', 'boat', 'train', 'motorcycle',
            'guitar', 'piano', 'violin', 'drum', 'soccer ball', 'basketball', 'tennis ball',
            'america', 'china', 'japan', 'france', 'titanic', 'avatar', 'star wars', 'einstein'
        ];
        
        // 计算每个单词的匹配得分 - 使用改进的中文匹配算法
        const wordScores = words.map(word => {
            const candidate = word.toLowerCase();
            const candidateEn = chineseToEnglish[candidate] || candidate;
            let maxScore = 0;
            let bestMatch = '';
            
            mockPredictions.forEach(prediction => {
                const label = prediction.toLowerCase();
                let similarity = 0;
                
                // 直接中文匹配
                if (label === candidate) {
                    similarity = 1.0;
                    bestMatch = label;
                }
                // 英文映射匹配
                else if (candidateEn && label.includes(candidateEn)) {
                    similarity = 0.9;
                    bestMatch = label;
                }
                else if (candidateEn && candidateEn.includes(label)) {
                    similarity = 0.85;
                    bestMatch = label;
                }
                // 语义相似度匹配
                else {
                    const labelWords = label.split(/[\s-_]+/);
                    const candidateWords = candidateEn.split(/[\s-_]+/);
                    
                    let wordMatches = 0;
                    candidateWords.forEach(cw => {
                        labelWords.forEach(lw => {
                            if (cw.length > 2 && lw.length > 2) {
                                if (cw === lw) wordMatches += 1.0;
                                else if (cw.includes(lw) || lw.includes(cw)) wordMatches += 0.7;
                            }
                        });
                    });
                    
                    similarity = wordMatches / Math.max(candidateWords.length, labelWords.length);
                    if (similarity > 0) bestMatch = label;
                }
                
                maxScore = Math.max(maxScore, similarity);
            });
            
            // 添加智能随机性，基于匹配质量
            const baseScore = maxScore * 0.85;
            const randomFactor = (Math.random() * 0.15) * (1 - maxScore); // 匹配越差，随机性越大
            const confidence = Math.min(baseScore + randomFactor, 0.95);
            
            return {
                word,
                score: confidence,
                confidence,
                bestMatch
            };
        });
        
        // 按得分排序
        wordScores.sort((a, b) => b.score - a.score);
        
        const bestGuess = wordScores[0].word;
        const confidence = wordScores[0].confidence;
        
        return Response.json({ 
            guess: bestGuess, 
            confidence,
            allResults: wordScores,
            debug: {
                type: 'mock_improved',
                wordCount: words.length
            }
        });

    } catch (error) {
        console.error(error.stack);
        return Response.json({ error: error.message }, {
            status: 500
        });
    }
}
