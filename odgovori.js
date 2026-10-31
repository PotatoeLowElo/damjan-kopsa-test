
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
        galleryGrid.replaceChildren(AnswersUI.message("Vprašanj trenutno ni mogoče naložiti.", "Osvežite stran in poskusite znova."));
        loadMoreButton.hidden = true;
        console.error(error);
    } finally {
        galleryGrid.setAttribute("aria-busy", "false");
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

function renderGallery() {
    const filtered = getFilteredAnswers();
    const visible = filtered.slice(0, visibleCount);

    galleryGrid.replaceChildren();

    visible.forEach(item => {
        galleryGrid.appendChild(AnswersUI.createCard(item));
    });

    if (filtered.length === 0) {
        const empty = allAnswers.length === 0
            ? AnswersUI.message("Trenutno še ni objavljenih odgovorov.", "Ko bodo odgovori objavljeni, jih boste našli tukaj. Svoje vprašanje lahko oddate prek povezave spodaj.")
            : AnswersUI.message("Ni zadetkov za izbrano iskanje.", "Poskusite z drugo ključno besedo ali ponastavite iskanje in kategorijo.");
        if (allAnswers.length > 0) {
            const reset = document.createElement("button");
            reset.type = "button";
            reset.className = "qa-reset";
            reset.textContent = "Ponastavi iskanje in filtre";
            reset.addEventListener("click", () => {
                answerSearch.value = "";
                categoryFilter.value = "Vse";
                visibleCount = 12;
                renderGallery();
                answerSearch.focus();
            });
            empty.appendChild(reset);
        }
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
    const previousCount = visibleCount;
    visibleCount += 12;
    renderGallery();
    galleryGrid.children[previousCount]?.querySelector(".qa-toggle")?.focus();
});

loadGallery();
