
const SUPABASE_URL =
    "https://waibzicptueaczltohuo.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_oicdAuwYu2YeCNyIACIBXQ_psZp0Bcn";

const PUBLIC_FUNCTION = "pridobi_javna_vprasanja";

const galleryGrid = document.getElementById("galleryGrid");
const galleryCount = document.getElementById("galleryCount");
const answerSearch = document.getElementById("answerSearch");
const categoryFilter = document.getElementById("categoryFilter");
const loadMoreButton = document.getElementById("loadMoreButton");

let allAnswers = [];
let visibleCount = 12;

document.getElementById("galleryYear").textContent =
    new Date().getFullYear();

async function loadGallery() {
    galleryCount.textContent = "Nalaganje vprašanj ...";

    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/${PUBLIC_FUNCTION}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": SUPABASE_KEY
                },
                body: JSON.stringify({})
            }
        );

        if (!response.ok) {
            throw new Error("Napaka pri pridobivanju vprašanj.");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Neveljaven odgovor strežnika.");
        }

        allAnswers = data;
        populateCategories();
        renderGallery();

    } catch (error) {
        galleryCount.textContent =
            "Vprašanj trenutno ni mogoče naložiti.";
        galleryGrid.replaceChildren();
        loadMoreButton.hidden = true;
        console.error(error);
    }
}

function populateCategories() {
    const categories = [
        ...new Set(
            allAnswers
                .map(item => item.kategorija)
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b, "sl"));

    categoryFilter.replaceChildren(
        new Option("Vse kategorije", "Vse")
    );

    categories.forEach(category => {
        categoryFilter.add(
            new Option(category, category)
        );
    });
}

function getFilteredAnswers() {
    const search = answerSearch.value
        .trim()
        .toLocaleLowerCase("sl");

    const category = categoryFilter.value;

    return allAnswers.filter(item => {
        const content = [
            item.vprasanje || "",
            item.odgovor || ""
        ].join(" ").toLocaleLowerCase("sl");

        const matchesSearch = content.includes(search);

        const matchesCategory =
            category === "Vse" ||
            item.kategorija === category;

        return matchesSearch && matchesCategory;
    });
}

function createFlipCard(item) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "flip-card";
    card.setAttribute("aria-pressed", "false");

    const inner = document.createElement("span");
    inner.className = "flip-card-inner";

    const front = document.createElement("span");
    front.className = "flip-card-front";

    const frontLabel = document.createElement("span");
    frontLabel.className = "flip-label";
    frontLabel.textContent = item.kategorija || "VPRAŠANJE";

    const question = document.createElement("span");
    question.className = "flip-question";
    question.textContent = item.vprasanje || "";

    const frontHint = document.createElement("span");
    frontHint.className = "flip-hint";
    frontHint.textContent = "↻ Kliknite za odgovor";

    front.append(frontLabel, question, frontHint);

    const back = document.createElement("span");
    back.className = "flip-card-back";

    const backLabel = document.createElement("span");
    backLabel.className = "flip-label";
    backLabel.textContent = "DAMJANOV ODGOVOR";

    const answer = document.createElement("span");
    answer.className = "flip-answer";
    answer.textContent = item.odgovor || "";

    const backHint = document.createElement("span");
    backHint.className = "flip-hint";
    backHint.textContent = "↻ Nazaj na vprašanje";

    back.append(backLabel, answer, backHint);

    inner.append(front, back);
    card.appendChild(inner);

    card.setAttribute(
        "aria-label",
        `Vprašanje: ${item.vprasanje}. Kliknite za odgovor.`
    );

    card.addEventListener("click", () => {
        const flipped = card.classList.toggle("flipped");

        card.setAttribute("aria-pressed", String(flipped));

        card.setAttribute(
            "aria-label",
            flipped
                ? `Odgovor: ${item.odgovor}. Kliknite za vprašanje.`
                : `Vprašanje: ${item.vprasanje}. Kliknite za odgovor.`
        );
    });

    return card;
}

function renderGallery() {
    const filtered = getFilteredAnswers();
    const visible = filtered.slice(0, visibleCount);

    galleryGrid.replaceChildren();

    visible.forEach(item => {
        galleryGrid.appendChild(createFlipCard(item));
    });

    if (filtered.length === 0) {
        const empty = document.createElement("p");
        empty.className = "gallery-empty";
        empty.textContent = allAnswers.length === 0
            ? "Trenutno še ni objavljenih odgovorov."
            : "Za izbrane kriterije ni vprašanj.";

        galleryGrid.appendChild(empty);
    }

    galleryCount.textContent =
        `Prikazanih ${visible.length} od ${filtered.length} vprašanj`;

    loadMoreButton.hidden = visibleCount >= filtered.length;
}

answerSearch.addEventListener("input", () => {
    visibleCount = 12;
    renderGallery();
});

categoryFilter.addEventListener("change", () => {
    visibleCount = 12;
    renderGallery();
});

loadMoreButton.addEventListener("click", () => {
    visibleCount += 12;
    renderGallery();
});

loadGallery();
