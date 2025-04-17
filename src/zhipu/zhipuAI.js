function zhipuAI(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
}

zhipuAI.prototype.chatCompletions = async function(params) {
    const defaultParams = {
        model: 'glm-4',
        messages: [],
        do_sample: true,
        stream: false,
    };

    const requestParams = { ...defaultParams, ...params };

    if (!requestParams.model) {
        throw new Error('Model is required');
    }
    if (!requestParams.messages || !Array.isArray(requestParams.messages) || requestParams.messages.length === 0) {
        throw new Error('Messages array is required and cannot be empty');
    }

    try {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(requestParams),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
        }

        if (requestParams.stream) {
            return await this.handleStreamResponse(response);
        } else {
            const data = await response.json();
            return data;
        }
    } catch (error) {
        throw new Error(`Request failed: ${error.message}`);
    }
};

zhipuAI.prototype.handleStreamResponse = async function(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let result = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    return result;
                }
                try {
                    const parsed = JSON.parse(data);
                    result += parsed.choices[0]?.delta?.content || '';
                } catch (e) {
                    console.error('Error parsing stream chunk:', e);
                }
            }
        }
    }

    return result;
};

module.exports = zhipuAI;