console.log("✅ FB Scraper started");

async function autoScroll() {
    return new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 800;
        let idle = 0;

        const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;

            const scrollHeight = document.body.scrollHeight;

            if (totalHeight >= scrollHeight - window.innerHeight) {
                idle++;
            }

            if (idle > 3) {
                clearInterval(timer);
                resolve();
            }
        }, 1200);
    });
}

// -------------------- HELPERS --------------------

const isValidText = (text) => {
    if (!text) return false;

    const invalidKeywords = [
        "like", "reply", "share", "comment",
        "write a comment"
    ];

    const lower = text.toLowerCase();

    return !invalidKeywords.some(k => lower.includes(k));
};

const cleanText = (text) => {
    return text?.replace(/\s+/g, " ").trim();
};

// -------------------- EXTRACT POST --------------------

const extractPost = (postEl) => {
    try {
        // AUTHOR
        const authorAnchor = postEl.querySelector('h2 a[role="link"], h3 a[role="link"]');

        const author_name = cleanText(authorAnchor?.innerText) || null;
        const author_profile = authorAnchor?.href || null;

        if (!author_name) return null;

        // AUTHOR IMAGE
        const author_image =
            postEl.querySelector('image')?.href?.baseVal ||
            postEl.querySelector('img')?.src ||
            null;

        // POST TIME
        const timeEl = postEl.querySelector('a[href*="/posts/"], a[href*="/videos/"], span a[role="link"]');
        const post_time = cleanText(timeEl?.innerText) || null;

        // POST CONTENT
        let post_content = null;

        const textBlocks = postEl.querySelectorAll('div[dir="auto"]');

        for (const el of textBlocks) {
            const text = cleanText(el.innerText);

            if (!text) continue;
            if (text === author_name) continue;
            if (!isValidText(text)) continue;

            // Avoid very short UI junk
            if (text.length < 20) continue;

            post_content = text;
            break;
        }

        if (!post_content) return null;

        return {
            author_name,
            author_profile,
            author_image,
            post_content,
            post_time
        };

    } catch (err) {
        return null;
    }
};

// -------------------- MAIN SCRAPER --------------------

async function scrapeFacebookPosts() {
    const results = [];
    const seen = new Set();

    // let roundsWithoutNew = 0;

    // while (roundsWithoutNew < 3) {
    const posts = document.querySelectorAll('[role="article"]');

    // let foundNew = false;

    posts.forEach(post => {
        const key = post.innerText.slice(0, 100);

        if (seen.has(key)) return;

        seen.add(key);

        const data = extractPost(post);

        if (data) {
            results.push(data);
            // foundNew = true;
        }
    });

    // if (!foundNew) {
    //     roundsWithoutNew++;
    // } else {
    //     roundsWithoutNew = 0;
    // }
    console.log("✅ Final Data:", results);

    await autoScroll();
    // }

    return results;
}

// -------------------- RUN --------------------

scrapeFacebookPosts();