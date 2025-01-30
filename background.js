const DEFAULT_MODEL = "gpt-3.5-turbo-1106";
const SYSTEM_MESSAGE = {
    role: "system",
    content: "I'm your helpful chat bot! I provide helpful and concise answers."
};
const MAX_HISTORY_LENGTH = 20;

// Initialize extension installation
chrome.runtime.onInstalled.addListener(handleInstall);
chrome.runtime.onMessage.addListener(handleMessage);

async function handleInstall() {
    await chrome.storage.local.set({
        apiModel: DEFAULT_MODEL,
        chatHistory: [SYSTEM_MESSAGE]
    });
    chrome.runtime.openOptionsPage();
}

async function handleMessage(message, sender, sendResponse) {
    if (message.userInput) {
        try {
            await processUserInput(message.userInput);
        } catch (error) {
            sendRuntimeError(error);
        }
    }
    return true;
}

async function processUserInput(userInput) {
    const { apiKey, apiModel, chatHistory } = await getStorageData([
        'apiKey',
        'apiModel',
        'chatHistory'
    ]);

    validateApiKey(apiKey);

    const updatedHistory = prepareChatHistory(chatHistory);
    updatedHistory.push({ role: "user", content: userInput });

    const response = await sendOpenAIRequest(updatedHistory, apiKey, apiModel);
    const assistantResponse = validateApiResponse(response);

    updatedHistory.push({ role: "assistant", content: assistantResponse });
    await saveChatHistory(updatedHistory);

    chrome.runtime.sendMessage({ answer: assistantResponse });
}

function validateApiKey(apiKey) {
    if (!apiKey) {
        throw new Error("API key missing. Please configure it in extension options.");
    }
}

function prepareChatHistory(history) {
    return Array.isArray(history) ? [...history] : [SYSTEM_MESSAGE];
}

async function sendOpenAIRequest(messages, apiKey, model) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                messages,
                model,
                temperature: 0.7
            })
        });

        return await handleApiResponse(response);
    } catch (error) {
        throw new Error(`Network error: ${error.message}`);
    }
}

async function handleApiResponse(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw createApiError(response.status, errorData);
    }
    return response.json();
}

function createApiError(status, errorData) {
    const messages = {
        400: "Invalid request parameters",
        401: "Invalid API key - please check your configuration",
        429: "API rate limit exceeded - try again later",
        500: "OpenAI server error",
        503: "Service unavailable - try again later"
    };

    return new Error(
        errorData.error?.message ||
        messages[status] ||
        `API request failed with status ${status}`
    );
}

function validateApiResponse(response) {
    if (!response?.choices?.[0]?.message?.content) {
        throw new Error("Received invalid response format from OpenAI API");
    }
    return response.choices[0].message.content;
}

async function saveChatHistory(history) {
    const truncated = history.length > MAX_HISTORY_LENGTH
        ? [history[0], ...history.slice(-MAX_HISTORY_LENGTH + 1)]
        : history;

    await chrome.storage.local.set({ chatHistory: truncated });
}

function sendRuntimeError(error) {
    console.error("Extension Error:", error);
    chrome.runtime.sendMessage({
        error: error.message || "An unexpected error occurred"
    });
}

async function getStorageData(keys) {
    return new Promise(resolve =>
        chrome.storage.local.get(keys, resolve)
    );
}