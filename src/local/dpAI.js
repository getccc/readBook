function dpAI(apiKey) {
    this.baseUrl = 'http://localhost/v1/chat-messages';
    this.apiKey = 'app-8g9oFrsK2jxvxXik5h5f0ij9';
}

dpAI.prototype.chatCompletions = async function(params) {
    const defaultParams = {
        model: 'deepseek-r1:7b',
        response_mode: 'blocking',
        user: 'user',
        inputs: {},
        query: ''
    };

    const requestParams = { ...defaultParams, ...params };

    if (!requestParams.model) {
        throw new Error('Model is required');
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

        const data = await response.json();
        if (!data.id) {
            throw new Error(`API request failed: ${data.error?.message || response.statusText}`);
        }
        return data;

        // if (requestParams.stream) {
        //     return await this.handleStreamResponse(response);
        // } else {
        //     const data = await response.json();
        //     return data;
        // }
    } catch (error) {
        throw new Error(`Request failed: ${error.message}`);
    }
};

dpAI.prototype.handleStreamResponse = async function(response) {
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

module.exports = dpAI;