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

async function scrapeFacebook() {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const collected = new Map();

    console.log("🚀 Step 1: Scrolling...");
    // await autoScrollDynamic({ maxRounds: 15 });

    console.log("📦 Step 2: Processing post-by-post...");

    const postElements = document.querySelectorAll('h2 a[role="link"]');

    console.log("🧱 Total posts found:", postElements.length);

    for (let authorEl of postElements) {
        try {
            // =========================
            // 🔥 FIND POST CONTAINER
            // =========================
            let section = authorEl;
            while (section && !section.querySelector('[dir="auto"]')) {
                section = section.parentElement;
            }
            if (!section) continue;

            // =========================
            // 🔥 POST DATA
            // =========================
            const author_name = authorEl.innerText?.trim();
            const author_profile = authorEl.href || null;

            if (!author_name) continue;

            const postKey = "post_" + author_name + author_profile;
            if (collected.has(postKey)) continue;

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
                post_url,
                type: "post"
            };

            collected.set(postKey, postData);
            console.log("✅ Post Added:", postData);

            // =========================
            // 🔥 COMMENTS FOR THIS POST ONLY
            // =========================
            const commentBlocks = section.querySelectorAll(
                'div[role="article"][aria-label*="Comment"]'
            );

            console.log(`💬 Comments for post (${author_name}):`, commentBlocks.length);

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
                            !text.includes("Reply") &&
                            !text.includes("See translation")
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
                        post_url,
                        type: "comment"
                    };

                    collected.set(commentKey, commentData);

                    console.log("💬 Comment Added:", commentData);

                } catch (err) {
                    console.error("❌ Comment error:", err);
                }
            });

            window.scrollBy({
                top: window.innerHeight * 0.8,
                behavior: "smooth"
            });

            await sleep(2000);

        } catch (err) {
            console.error("❌ Post loop error:", err);
        }
    }

    const results = Array.from(collected.values());

    console.log("🎯 FINAL:", results);
    return results;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "SCRAPE") return;

    (async () => {
        console.log("🚀 FB INCREMENTAL SCRAPER STARTED");

        scrapeFacebook().then((data) => {
            console.log("📤 Sending data to popup:", data);
            sendResponse({ success: true, data });
        }).catch((err) => {
            console.error("❌ Scrape error:", err);
            sendResponse({ success: false, error: err.message });
        });
    })();

    return true;
});