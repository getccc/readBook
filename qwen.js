// const { OpenAI } = require('openai');

// // 配置参数
// const DEFAULT_TEMPERATURE = 0.7;
// const config = {
//     baseUrl: 'http://113.57.121.225:11333/v1',
//     apiKey: 'changeMe123',
//     chatModel: 'qwen2.5:14b'
// };

// // 初始化 OpenAI 客户端
// const openai = new OpenAI({
//     apiKey: config.apiKey,
//     baseURL: config.baseUrl, // 注意：OpenAI 库使用 baseURL 而不是 base_url
//     timeout: 30 * 1000, // 超时时间，单位为毫秒（30秒）
//     maxRetries: 2 // 最大重试次数
// });

// // 异步函数：测试与模型的连接
// async function testModelConnection() {
//     try {
//         const response = await openai.chat.completions.create({
//             model: config.chatModel,
//             messages: [
//                 { role: 'system', content: 'You are a helpful assistant.' },
//                 { role: 'user', content: 'Hello, world! Please respond with a greeting.' }
//             ],
//             temperature: DEFAULT_TEMPERATURE,
//             max_tokens: 512 // 可根据需要调整
//         });

//         // 打印模型响应
//         console.log('Model Response:', response.choices[0].message.content);
//     } catch (error) {
//         // 捕获并打印错误信息
//         console.error('Error connecting to the model:', error.message);
//         if (error.response) {
//             console.error('Response status:', error.response.status);
//             console.error('Response data:', error.response.data);
//         }
//     }
// }

// // 执行测试
// testModelConnection();

const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: 'changeMe123',
    // baseURL: 'http://192.168.1.17:11333/v1'
    baseURL: 'http://113.57.121.225:11333/v1'
});

async function listModels() {
    try {
        const models = await openai.models.list();
        console.log('Available Models:', models.data);
    } catch (error) {
        console.error('Error fetching models:', error.message);
    }
}

listModels();