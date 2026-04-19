console.log("📩 FB Scraper (FINAL FIXED)");

async function scrapeFacebook() {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const collected = new Map();

    let idleRounds = 0;
    let lastCount = 0;

    console.log("🚀 Starting incremental scroll + scrape...");

    let round = 0;
    while (true) {
        round++;

        // =========================
        // 🔥 STEP 1: GET POSTS CURRENTLY IN DOM
        // =========================
        const postElements = document.querySelectorAll('h2 a[role="link"]');

        console.log(`📊 Round ${round + 1} | Found: ${postElements.length}`);

        // =========================
        // 🔥 STEP 2: PROCESS EACH POST
        // =========================
        for (let authorEl of postElements) {
            try {
                let section = authorEl;

                while (section && !section.querySelector('[dir="auto"]')) {
                    section = section.parentElement;
                }
                if (!section) continue;

                const author_name = authorEl.innerText?.trim();
                const author_profile = authorEl.href || null;

                if (!author_name) continue;

                // ✅ UNIQUE KEY
                const postKey = "post_" + author_name + author_profile;
                if (collected.has(postKey)) continue;

                // =========================
                // 🔥 POST CONTENT
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
                // 🔥 AUTHOR IMAGE
                // =========================
                let author_image = null;
                const img = section.querySelector("image");
                if (img) {
                    author_image = img.getAttribute("xlink:href");
                }

                // =========================
                // 🔥 ✅ POST URL (NEW)
                // =========================
                let post_url = null;

                const linkEl =
                    section.querySelector('a[href*="/posts/"]') ||
                    section.querySelector('a[href*="/permalink/"]') ||
                    section.querySelector('a[href*="story.php"]');

                if (linkEl) {
                    post_url = linkEl.href;
                }

                const postData = {
                    author_name,
                    author_profile,
                    author_image,
                    post_content,
                    post_url, // ✅ ADDED
                    type: "post"
                };

                collected.set(postKey, postData);
                console.log("✅ Post Added:", postData);

                // =========================
                // 🔥 COMMENTS (POST-WISE)
                // =========================
                const commentBlocks = section.querySelectorAll(
                    'div[role="article"][aria-label*="Comment"]'
                );

                commentBlocks.forEach((block) => {
                    try {
                        const authorEl = block.querySelector('a[role="link"] span[dir="auto"]');
                        const comment_author = authorEl?.innerText?.trim();

                        const profileEl = block.querySelector('a[role="link"]');
                        const comment_profile = profileEl?.href || null;

                        if (!comment_author) return;

                        const commentKey = "comment_" + comment_author + comment_profile;
                        if (collected.has(commentKey)) return;

                        let post_content = null;
                        const textEls = block.querySelectorAll('div[dir="auto"]');

                        for (let el of textEls) {
                            const text = el.innerText?.trim();

                            if (
                                text &&
                                text !== comment_author &&
                                !text.includes("Like") &&
                                !text.includes("Reply")
                            ) {
                                post_content = text;
                                break;
                            }
                        }

                        let author_image = null;
                        const img = block.querySelector("image");
                        if (img) {
                            author_image = img.getAttribute("xlink:href");
                        }

                        const commentData = {
                            author_name: comment_author,
                            author_profile: comment_profile,
                            author_image,
                            post_content,
                            post_url, // ✅ LINK COMMENT TO POST
                            type: "comment"
                        };

                        collected.set(commentKey, commentData);

                        console.log("💬 Comment Added:", commentData);

                    } catch (err) {
                        console.error("❌ Comment error:", err);
                    }
                });

            } catch (err) {
                console.error("❌ Post loop error:", err);
            }
        }

        // =========================
        // 🔥 STEP 3: SCROLL
        // =========================
        window.scrollBy({
            top: window.innerHeight * 0.8,
            behavior: "smooth"
        });

        await sleep(2000);

        // =========================
        // 🔥 STEP 4: STOP CONDITION
        // =========================
        const newCount = document.querySelectorAll('h2 a[role="link"]').length;

        if (newCount === lastCount) {
            idleRounds++;
            console.log("⏸️ No new posts");

            if (idleRounds >= 3) {
                console.log("🛑 Stopping - no more content");
                break;
            }
        } else {
            idleRounds = 0;
        }

        lastCount = newCount;

        if (round > 50) {
            console.log("🛑 Safety stop (avoid infinite loop)");
            break;
        }
    }

    const results = Array.from(collected.values());

    console.log("🎯 FINAL:", results);
    return results;
}


// =========================
// 🔥 CHROME LISTENER
// =========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "SCRAPE") return;

    (async () => {
        console.log("🚀 FB SCRAPER STARTED");

        scrapeFacebook()
            .then((data) => {
                sendResponse({ success: true, data });
            })
            .catch((err) => {
                sendResponse({ success: false, error: err.message });
            });
    })();

    return true;
});