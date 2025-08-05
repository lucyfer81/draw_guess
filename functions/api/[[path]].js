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

    if (route === 'guess' && request.method === 'POST') {
        return handleGuessMock(request, env);
    }

    return new Response('API route not found', { status: 404 });
}

function handleNewGame() {
    const wordBank = {
        animals: ['cat', 'dog', 'bird', 'fish', 'elephant', 'lion', 'tiger', 'bear', 'snake', 'rabbit', 'monkey', 'giraffe'],
        food: ['apple', 'banana', 'pizza', 'hamburger', 'sushi', 'ice cream', 'cake', 'spaghetti', 'chocolate', 'coffee'],
        movies: ['Titanic', 'Inception', 'Avatar', 'The Matrix', 'Star Wars', 'The Godfather', 'Jurassic Park', 'The Lion King'],
        countries: ['USA', 'China', 'Japan', 'France', 'Brazil', 'Australia', 'Canada', 'Mexico', 'Italy', 'Germany'],
        vehicles: ['car', 'bus', 'bicycle', 'airplane', 'boat', 'train', 'motorcycle', 'helicopter', 'truck'],
        'famous-people': ['Einstein', 'Marilyn Monroe', 'Elvis', 'Shakespeare', 'Nelson Mandela', 'Michael Jackson', 'Madonna'],
        sports: ['soccer', 'basketball', 'tennis', 'golf', 'swimming', 'cycling', 'boxing', 'volleyball'],
        'musical-instruments': ['guitar', 'piano', 'violin', 'drums', 'flute', 'trumpet', 'saxophone', 'harp']
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
            return Response.json({ error: 'Invalid request body' }, { status: 400 });
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