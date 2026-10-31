
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
            container.appendChild(AnswersUI.message(
                "Trenutno še ni objavljenih odgovorov.",
                "Ko bodo odgovori objavljeni, jih boste lahko prebrali tukaj. Svoje vprašanje lahko oddate prek spodnjega obrazca."
            ));
            return;
        }

        answers.slice(0, 5).forEach(item => {
            container.appendChild(AnswersUI.createCard(item));
        });

    } catch (error) {
        container.replaceChildren(AnswersUI.message("Odgovorov trenutno ni mogoče prikazati.", "Osvežite stran in poskusite znova."));
    } finally {
        container.setAttribute("aria-busy", "false");
    }
}

loadPublicAnswers();


// LETNICA

const yearElement = document.getElementById("year");

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}
