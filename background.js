const DEFAULT_MODEL = "gpt-4o";

// Improve the system message for better summarization
const SYSTEM_MESSAGE = {
    role: "system",
    content: "You are a precise summarization assistant. Create clear, concise summaries that capture the key points while maintaining accuracy. Keep summaries brief but informative."
};


// If the user has not entered an API key, open the options page
chrome.storage.local.get('apiKey', ({ apiKey }) => {
    if (!apiKey || apiKey.length < 10) {
        chrome.runtime.openOptionsPage();
    }
});


// Context menu setup
chrome.contextMenus.create({
    id: "summarizeText",
    title: "Summarize Selected Text",
    contexts: ["selection"],
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "summarizeText") {
        const selectedText = info.selectionText;
        try {
            const summary = await getSummaryFromOpenAI(selectedText);
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: createTooltip,
                args: [summary]
            });
        } catch (error) {
            console.error('Error:', error);
        }
    }
});

async function getSummaryFromOpenAI(text) {
    const { apiKey, apiModel } = await chrome.storage.local.get(['apiKey', 'apiModel']);
    if (!apiKey) throw new Error("API key missing");

    const messages = [
        SYSTEM_MESSAGE,
        {
            role: "user",
            content: `Summarize the following text in a concise way, focusing on the main points and key takeaways:\n\n${text}`
        }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            messages,
            model: apiModel || DEFAULT_MODEL,
            temperature: 0.3,  // Lower temperature for more focused responses
            max_tokens: 150    // Limit response length for conciseness
        })
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

function createTooltip(summaryText) {
    const tooltip = document.createElement('div');
    tooltip.id = 'customTooltip';
    tooltip.style.cssText = `
        position: absolute;
        background: #333;
        color: #fff;
        padding: 10px;
        border-radius: 5px;
        width: 300px;
        z-index: 1000;
        display: block;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    tooltip.textContent = summaryText;

    const closeIcon = document.createElement('span');
    closeIcon.textContent = '✖';
    closeIcon.style.cssText = `
        cursor: pointer;
        color: red;
        position: absolute;
        top: 10px;
        right: 10px;
    `;

    tooltip.appendChild(closeIcon);
    document.body.appendChild(tooltip);

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 40}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;

    // Adjust position if outside viewport
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.top < 0) tooltip.style.top = '0';
    if (tooltipRect.left < 0) tooltip.style.left = '0';
    if (tooltipRect.right > window.innerWidth) {
        tooltip.style.left = `${window.innerWidth - tooltipRect.width}px`;
    }

    closeIcon.addEventListener('click', () => tooltip.remove());
}