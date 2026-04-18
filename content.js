console.log("📩 FB Scraper (STRUCTURE FIX)");
async function autoScrollDynamic({ maxRounds = 10 } = {}) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    let lastPostCount = 0;
    let idleRounds = 0;

    for (let round = 0; round < maxRounds; round++) {
        // 🔥 Get current posts (using your stable selector)
        const posts = document.querySelectorAll('h2 a[role="link"]');
        const currentCount = posts.length;

        console.log(`📊 Round ${round + 1} | Posts: ${currentCount}`);

        // =========================
        // 🔥 Dynamic scroll distance
        // =========================
        let scrollDistance = window.innerHeight * 0.8;

        // Try improving using last post height
        const lastPost = posts[posts.length - 1]?.closest("div");
        if (lastPost) {
            const rect = lastPost.getBoundingClientRect();
            if (rect.height > 200) {
                scrollDistance = rect.height;
            }
        }

        console.log("🔽 Scrolling by:", scrollDistance);

        window.scrollBy({
            top: scrollDistance,
            behavior: "smooth"
        });

        // wait for FB to load content
        await sleep(2000);

        const newCount = document.querySelectorAll('h2 a[role="link"]').length;

        // =========================
        // 🔥 Detect idle (no new posts)
        // =========================
        if (newCount === currentCount) {
            idleRounds++;
            console.log("⏸️ No new posts detected");

            if (idleRounds >= 3) {
                console.log("🛑 Stopping scroll (no more content)");
                break;
            }
        } else {
            idleRounds = 0;
        }

        lastPostCount = newCount;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "SCRAPE") return;

    (async () => {
        console.log("🚀 FB INCREMENTAL SCRAPER STARTED");

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        const collected = new Map(); // 🔥 dedup store

        function extractPosts() {
            const authorLinks = document.querySelectorAll('h2 a[role="link"]');

            console.log("👤 Found:", authorLinks.length);

            authorLinks.forEach((authorEl) => {
                try {
                    const author_name = authorEl.innerText?.trim();
                    const author_profile = authorEl.href;

                    if (!author_name || !author_profile) return;

                    // 🔥 unique key (important)
                    const key = author_profile;

                    if (collected.has(key)) return; // skip duplicate

                    // =========================
                    // FIND SECTION (STRUCTURE SAFE)
                    // =========================
                    let section = authorEl;

                    while (section && !section.querySelector('[dir="auto"]')) {
                        section = section.parentElement;
                    }

                    if (!section) return;

                    // =========================
                    // CONTENT
                    // =========================
                    let post_content = null;

                    const contentEls = section.querySelectorAll('[dir="auto"]');

                    for (let el of contentEls) {
                        const text = el.innerText?.trim();

                        if (
                            text &&
                            text.length > 20 &&
                            text !== author_name &&
                            !text.includes("Like") &&
                            !text.includes("Reply")
                        ) {
                            post_content = text;
                            break;
                        }
                    }

                    // =========================
                    // IMAGE
                    // =========================
                    let author_image = null;
                    const imageEl = section.querySelector("image");
                    if (imageEl) {
                        author_image = imageEl.getAttribute("xlink:href");
                    }

                    // =========================
                    // TIME
                    // =========================
                    let post_time = null;
                    const timeEl = section.querySelector('a[aria-label]');
                    if (timeEl) {
                        post_time = timeEl.getAttribute("aria-label");
                    }

                    // =========================
                    // POST ID
                    // =========================
                    let postId = null;
                    const postLink = section.querySelector('a[href*="/posts/"]');
                    if (postLink) {
                        const match = postLink.href.match(/posts\/(\d+)/);
                        if (match) postId = match[1];
                    }

                    const data = {
                        postId,
                        author_name,
                        author_profile,
                        author_image,
                        post_content,
                        post_time
                    };

                    collected.set(key, data);

                    console.log("✅ Added:", data);

                } catch (err) {
                    console.error("❌ Extract error:", err);
                }
            });
        }

        // =========================
        // 🔥 INCREMENTAL SCROLL LOOP
        // =========================
        let idleRounds = 0;

        for (let i = 0; i < 20; i++) {
            console.log(`\n🔁 SCROLL ITERATION ${i + 1}`);

            // 🔥 STEP 1: extract BEFORE scroll (captures first items)
            extractPosts();

            const beforeCount = collected.size;

            // =========================
            // DYNAMIC SCROLL
            // =========================
            const scrollDistance = window.innerHeight * 0.8;

            window.scrollBy({
                top: scrollDistance,
                behavior: "smooth"
            });

            await sleep(2000);

            // 🔥 STEP 2: extract AFTER scroll
            extractPosts();

            const afterCount = collected.size;

            // =========================
            // STOP CONDITION
            // =========================
            if (afterCount === beforeCount) {
                idleRounds++;
                console.log("⏸️ No new data");

                if (idleRounds >= 3) {
                    console.log("🛑 Stopping (no more new posts)");
                    break;
                }
            } else {
                idleRounds = 0;
            }
        }

        // =========================
        // FINAL RESULT
        // =========================
        const results = Array.from(collected.values());

        console.log("🎯 FINAL RESULT:", results);

        return results;
    })();

    return true;
});