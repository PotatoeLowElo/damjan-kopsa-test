
const menuToggle = document.getElementById("menuToggle");
const navigation = document.getElementById("navigation");

const navLinks = document.querySelectorAll("#navigation a");

const SUPABASE_URL =
    "https://waibzicptueaczltohuo.supabase.co";

const QUESTION_FUNCTION_URL =
    `${SUPABASE_URL}/functions/v1/smooth-processor`;

const PUBLIC_ANSWERS_URL =
    `${SUPABASE_URL}/rest/v1/rpc/pridobi_javna_vprasanja`;

const SUPABASE_ANON_KEY =
    "sb_publishable_oicdAuwYu2YeCNyIACIBXQ_psZp0Bcn";


// MOBILNI MENI

if (menuToggle && navigation) {
    menuToggle.addEventListener("click", () => {
        const isOpen = navigation.classList.toggle("open");

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.classList.toggle("is-active", isOpen);
    });

    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            navigation.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.classList.remove("is-active");
        });
    });
}


// AKTIVNI RAZDELEK

const sections = document.querySelectorAll("main section[id]");

if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const id = entry.target.id;

                navLinks.forEach(link => {
                    link.classList.toggle(
                        "active",
                        link.getAttribute("href") === `#${id}`
                    );
                });
            });
        },
        {
            rootMargin: "-20% 0px -65% 0px"
        }
    );

    sections.forEach(section => sectionObserver.observe(section));
}


// ANIMACIJE OB PREMIKANJU

const animatedElements = document.querySelectorAll(
    ".section-content, .program-card, .quote-card, .about-image"
);

animatedElements.forEach(element => {
    element.classList.add("reveal");
});

if ("IntersectionObserver" in window) {
    const animationObserver = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    animationObserver.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.1
        }
    );

    animatedElements.forEach(element => {
        animationObserver.observe(element);
    });
} else {
    animatedElements.forEach(element => {
        element.classList.add("visible");
    });
}


// PRETVORBA SEKUND V URE IN MINUTE

function formatRemainingTime(seconds) {
    const remaining = Math.max(0, Math.ceil(Number(seconds)));

    if (!Number.isFinite(remaining)) {
        return null;
    }

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.ceil((remaining % 3600) / 60);

    if (hours > 0 && minutes > 0) {
        return `${hours} ur in ${minutes} minut`;
    }

    if (hours > 0) {
        return `${hours} ur`;
    }

    if (minutes > 0) {
        return `${minutes} minut`;
    }

    return "manj kot minuto";
}


// ODDAJA VPRAŠANJ

const questionForm = document.getElementById("questionForm");
const formMessage = document.getElementById("formMessage");

if (questionForm && formMessage) {
    questionForm.addEventListener("submit", async event => {
        event.preventDefault();

        const button = document.getElementById("submitQuestion");

        const token = document.querySelector(
            '[name="cf-turnstile-response"]'
        )?.value;

        if (!token) {
            formMessage.textContent =
                "Potrdite varnostno preverjanje.";
            return;
        }

        const payload = {
            kategorija: document.getElementById("category").value,
            vprasanje: document.getElementById("question").value.trim(),
            ime: document.getElementById("person").value.trim(),
            email: document.getElementById("email").value.trim(),
            captcha: token
        };

        if (
            payload.vprasanje.length < 10 ||
            payload.vprasanje.length > 5000
        ) {
            formMessage.textContent =
                "Vprašanje mora vsebovati od 10 do 5000 znakov.";
            return;
        }

        button.disabled = true;
        formMessage.textContent = "Pošiljanje vprašanja ...";

        try {
            const response = await fetch(QUESTION_FUNCTION_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            let result = {};

            try {
                result = await response.json();
            } catch (_) {
                // Strežnik ni vrnil veljavnega JSON odgovora.
            }

            if (!response.ok) {
                const remainingSeconds =
                    Number(result.preostale_sekunde);

                if (
                    result.preostale_sekunde != null &&
                    Number.isFinite(remainingSeconds) &&
                    remainingSeconds > 0
                ) {
                    const remainingTime =
                        formatRemainingTime(remainingSeconds);

                    formMessage.textContent =
                        "Z vašega omrežja je bilo vprašanje že poslano. " +
                        `Novo vprašanje lahko pošljete čez ${remainingTime}.`;
                } else {
                    formMessage.textContent =
                        result.message ||
                        result.error ||
                        "Vprašanja trenutno ni mogoče poslati. Poskusite pozneje.";
                }

                return;
            }

            questionForm.reset();

            if (window.turnstile) {
                window.turnstile.reset();
            }

            formMessage.textContent =
                "Vprašanje je bilo uspešno poslano. Hvala!";

        } catch (error) {
            console.error("Napaka pri oddaji vprašanja:", error);

            formMessage.textContent =
                "Povezava s strežnikom ni uspela. Poskusite pozneje.";

        } finally {
            if (window.turnstile) {
                window.turnstile.reset();
            }

            button.disabled = false;
        }
    });
}


// OKNO ZA DALJŠE ODGOVORE

const answerDialog = document.createElement("dialog");
answerDialog.className = "answer-dialog";
answerDialog.setAttribute("aria-label", "Celoten Damjanov odgovor");

const dialogClose = document.createElement("button");
dialogClose.type = "button";
dialogClose.className = "answer-dialog-close";
dialogClose.textContent = "✕ Zapri";

const dialogQuestion = document.createElement("h3");
const dialogAnswer = document.createElement("p");
dialogAnswer.className = "answer-dialog-text";

answerDialog.append(dialogClose, dialogQuestion, dialogAnswer);
document.body.appendChild(answerDialog);

dialogClose.addEventListener("click", () => answerDialog.close());

answerDialog.addEventListener("click", event => {
    if (event.target === answerDialog) {
        answerDialog.close();
    }
});

const answerDialogStyles = document.createElement("style");

answerDialogStyles.textContent = `
.answer-read-more {
    display: block;
    width: 100%;
    padding: 10px 12px;
    margin-top: 12px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
}

.answer-read-more:hover {
    background: rgba(255, 255, 255, 0.22);
}

.answer-read-more:focus-visible {
    outline: 2px solid #ffcc00;
    outline-offset: 3px;
}
.answer-dialog:not([open]) {
    display: none;
}

.answer-dialog[open] {
    position: fixed;
    inset: 0;
    margin: auto;
}
.answer-dialog {
    width: min(680px, calc(100% - 32px));
    max-height: min(85vh, 850px);
    padding: 32px;
    border: 1px solid #dbe8df;
    border-radius: 18px;
    background: #fff;
    color: #18352a;
    box-shadow: 0 24px 80px rgba(0,0,0,.22);
    overflow-y: auto;
}

.answer-dialog::backdrop {
    background: rgba(0, 0, 0, .65);
}

.answer-dialog-close {
    display: block;
    margin: 0 0 24px auto;
    padding: 10px 15px;
    border: 0;
    border-radius: 8px;
    background: #00563e;
    color: white;
    font: inherit;
    cursor: pointer;
}

.answer-dialog h3 {
    margin: 0 0 20px;
    line-height: 1.4;
}

.answer-dialog-text {
    margin: 0;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}
`;

document.head.appendChild(answerDialogStyles);


// JAVNI ODGOVORI

async function loadPublicAnswers() {
    const container = document.getElementById("answersList");

    if (!container) return;

    try {
        const response = await fetch(PUBLIC_ANSWERS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            throw new Error("Napaka pri nalaganju odgovorov.");
        }

        const answers = await response.json();

        const allAnswersButton =
            document.getElementById("allAnswersButton");

        if (allAnswersButton) {
            allAnswersButton.hidden = answers.length <= 5;
        }

        container.replaceChildren();

        if (!answers.length) {
            const message = document.createElement("p");
            message.textContent =
                "Trenutno še ni objavljenih odgovorov.";
            container.appendChild(message);
            return;
        }

        answers.slice(0, 5).forEach(item => {
const card = document.createElement("div");
card.setAttribute("role", "button");
card.setAttribute("tabindex", "0");
            card.className = "flip-card";
            card.setAttribute("aria-pressed", "false");
            card.setAttribute(
                "aria-label",
                "Vprašanje: " + item.vprasanje + ". Kliknite za odgovor."
            );

            const inner = document.createElement("span");
            inner.className = "flip-card-inner";

            const front = document.createElement("span");
            front.className = "flip-card-front";

            const frontLabel = document.createElement("span");
            frontLabel.className = "flip-label";
            frontLabel.textContent = "VPRAŠANJE";

            const question = document.createElement("span");
            question.className = "flip-question";
            question.textContent = item.vprasanje;

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

            const fullAnswer = String(item.odgovor || "");
            const isLongAnswer = fullAnswer.length > 280;

            answer.textContent = isLongAnswer
                ? fullAnswer.slice(0, 220).trimEnd() + "…"
                : fullAnswer;

            const backHint = document.createElement("span");
            backHint.className = "flip-hint";

            backHint.textContent = isLongAnswer
                ? "↻ Nazaj na vprašanje"
                : "↻ Nazaj na vprašanje";

            back.append(backLabel, answer, backHint);

            inner.append(front, back);
            card.appendChild(inner);

            if (isLongAnswer) {
                const readMore = document.createElement("button");

                readMore.type = "button";
                readMore.className = "answer-read-more";
                readMore.textContent = "Preberi celoten odgovor →";

                readMore.addEventListener("click", event => {
                    event.stopPropagation();

                    dialogQuestion.textContent = item.vprasanje;
                    dialogAnswer.textContent = fullAnswer;

                    answerDialog.showModal();
                });

                back.appendChild(readMore);
            }

            card.addEventListener("click", event => {
                if (event.target.closest(".answer-read-more")) {
                    return;
                }

                const isFlipped = card.classList.toggle("flipped");

                card.setAttribute("aria-pressed", String(isFlipped));
            });

            container.appendChild(card);
        });

    } catch (error) {
        container.textContent =
            "Odgovorov trenutno ni mogoče prikazati.";
    }
}

loadPublicAnswers();


// LETNICA

const yearElement = document.getElementById("year");

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}
