console.log("✅ FB Scraper popup script loaded");

document.getElementById("scrape").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tab?.id) {
        console.error("❌ No active tab found");
        return;
    }

    try {
        // 🔥 STEP 1: Inject content.js manually
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
        });

        console.log("🚀 content.js injected");

        // 🔥 STEP 2: Send message AFTER injection
        chrome.tabs.sendMessage(
            tab.id,
            { action: "SCRAPE" },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error("❌ Error:", chrome.runtime.lastError.message);
                    return;
                }

                console.log("✅ Response:", response);

                document.getElementById("output").textContent =
                    JSON.stringify(response, null, 2);
            }
        );

    } catch (err) {
        console.error("❌ Injection failed:", err);
    }
});