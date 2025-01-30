document.getElementById("saveKeyBtn").addEventListener("click", async () => {
    const apiKey = document.getElementById("apiKey").value.trim();
    if (!apiKey) {
        document.getElementById("status").textContent = "Please enter an API key.";
        return;
    }
    await chrome.storage.local.set({ apiKey });
    document.getElementById("status").textContent = "API key saved you can close this window.";
});