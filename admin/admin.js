
const SUPABASE_URL = "https://waibzicptueaczltohuo.supabase.co";
const SUPABASE_KEY = "sb_publishable_oicdAuwYu2YeCNyIACIBXQ_psZp0Bcn";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);

const loginPage = $("loginPage");
const mfaPage = $("mfaPage");
const dashboard = $("dashboard");
const loginForm = $("loginForm");
const loginMessage = $("loginMessage");
const mfaMessage = $("mfaMessage");
const mfaCode = $("mfaCode");
const dashboardMessage = $("dashboardMessage");
const proposalsList = $("proposalsList");
const statusFilter = $("statusFilter");

let questions = [];
let pendingFactorId = null;
let authFlowBusy = false;
let analyticsRequestId = 0;

function showLogin() {
    loginPage.classList.remove("hidden");
    mfaPage.classList.add("hidden");
    dashboard.classList.add("hidden");
    pendingFactorId = null;
    mfaCode.value = "";
    questions = [];
    analyticsRequestId++;
}

function showMfa() {
    loginPage.classList.add("hidden");
    mfaPage.classList.remove("hidden");
    dashboard.classList.add("hidden");
    mfaMessage.textContent = "";
    mfaCode.value = "";
}

function showDashboard() {
    loginPage.classList.add("hidden");
    mfaPage.classList.add("hidden");
    dashboard.classList.remove("hidden");
}

async function checkAdmin() {
    const { data, error } = await db.rpc("is_admin");
    if (error) throw error;
    return data === true;
}

async function requireAal2() {
    const { data, error } =
        await db.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) throw error;
    return data?.currentLevel === "aal2";
}

async function prepareMfa() {
    const { data: factors, error: factorsError } =
        await db.auth.mfa.listFactors();

    if (factorsError) throw factorsError;

    const verified = (factors?.totp || [])
        .find(factor => factor.status === "verified");

    showMfa();

    if (verified) {
        pendingFactorId = verified.id;
        $("mfaQr").classList.add("hidden");
        $("mfaSecret").classList.add("hidden");

        $("mfaIntro").textContent =
            "Odpri aplikacijo Authenticator in vpiši trenutno 6-mestno kodo.";
    } else {
        const { data, error } = await db.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: "Administracija Damjan Kopša"
        });

        if (error) throw error;

        pendingFactorId = data.id;

        $("mfaQr").src = data.totp.qr_code;
        $("mfaQr").classList.remove("hidden");

        $("mfaSecret").textContent =
            "Ročni ključ: " + data.totp.secret;
        $("mfaSecret").classList.remove("hidden");

        $("mfaIntro").textContent =
            "Skeniraj QR-kodo z aplikacijo Google ali Microsoft Authenticator. " +
            "Nato vpiši 6-mestno kodo za potrditev.";
    }

    mfaCode.focus();
}

async function enterAdmin() {
    if (!await requireAal2()) {
        await prepareMfa();
        return;
    }

    if (!await checkAdmin()) {
        await db.auth.signOut();
        showLogin();
        loginMessage.textContent =
            "Ta račun nima administratorskih pravic.";
        return;
    }

    showDashboard();
    await loadQuestions();
}

async function continueAuth() {
    if (authFlowBusy) return;
    authFlowBusy = true;

    try {
        const { data: { session }, error } =
            await db.auth.getSession();

        if (error) throw error;

        if (!session) {
            showLogin();
            return;
        }

        if (await requireAal2()) {
            await enterAdmin();
        } else {
            await prepareMfa();
        }
    } catch (error) {
        showLogin();
        loginMessage.textContent =
            "Prijava ni uspela: " + error.message;
    } finally {
        authFlowBusy = false;
    }
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const button = $("loginButton");
    button.disabled = true;
    loginMessage.textContent = "Prijavljanje ...";

    try {
        const { error } = await db.auth.signInWithPassword({
            email: $("email").value.trim(),
            password: $("password").value
        });

        if (error) throw error;

        loginMessage.textContent = "";
        await continueAuth();
    } catch (error) {
        loginMessage.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

$("mfaForm").addEventListener("submit", async event => {
    event.preventDefault();

    const button = $("mfaVerifyButton");
    button.disabled = true;
    mfaMessage.textContent = "Preverjam kodo ...";

    try {
        if (!pendingFactorId) {
            throw new Error("Manjka nastavitev preverjanja.");
        }

        const code = mfaCode.value.trim();

        if (!/^\d{6}$/.test(code)) {
            throw new Error("Vnesi 6-mestno kodo.");
        }

        const { data: challenge, error: challengeError } =
            await db.auth.mfa.challenge({
                factorId: pendingFactorId
            });

        if (challengeError) throw challengeError;

        const { error: verifyError } = await db.auth.mfa.verify({
            factorId: pendingFactorId,
            challengeId: challenge.id,
            code
        });

        if (verifyError) throw verifyError;

        mfaMessage.textContent = "";
        await enterAdmin();
    } catch (error) {
        mfaMessage.textContent =
            "Potrditev ni uspela: " + error.message;
    } finally {
        button.disabled = false;
    }
});

async function logout() {
    analyticsRequestId++;
    await db.auth.signOut();
    showLogin();
    loginForm.reset();
}

$("logoutButton").addEventListener("click", logout);
$("mfaCancelButton").addEventListener("click", logout);

$("refreshButton").addEventListener("click", loadQuestions);
statusFilter.addEventListener("change", renderQuestions);

async function loadQuestions() {
    if (!await requireAal2()) {
        await continueAuth();
        return;
    }

    dashboardMessage.textContent = "Nalaganje vprašanj ...";

    const { data, error } = await db
        .from("vprasanja")
        .select(
            "id, kategorija, vprasanje, ime, email, odgovor, objavljeno, ustvarjeno, odgovorjeno"
        )
        .order("ustvarjeno", { ascending: false });

    if (error) {
        dashboardMessage.textContent =
            "Napaka pri nalaganju: " + error.message;
        return;
    }

    questions = data || [];
    dashboardMessage.textContent = "";
    updateStats();
    renderQuestions();
}

function updateStats() {
    $("totalCount").textContent = questions.length;

    $("newCount").textContent =
        questions.filter(q => !q.odgovor).length;

    $("progressCount").textContent =
        questions.filter(q => q.odgovor && !q.objavljeno).length;

    $("doneCount").textContent =
        questions.filter(q => q.objavljeno).length;
}

function createElement(tag, className, content) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;

    return element;
}

function renderQuestions() {
    proposalsList.replaceChildren();

    const filter = statusFilter.value;

    const filtered = questions.filter(q => {
        if (filter === "Vsi") return true;
        if (filter === "Nov") return !q.odgovor;

        if (filter === "V obravnavi") {
            return Boolean(q.odgovor) && !q.objavljeno;
        }

        if (filter === "Zaključen") return q.objavljeno;

        return true;
    });

    if (!filtered.length) {
        proposalsList.appendChild(
            createElement("p", "empty-state", "Ni vprašanj za prikaz.")
        );
        return;
    }

    filtered.forEach(question => {
        const card = createElement("article", "proposal-card");
        const top = createElement("div", "proposal-top");

        const category = createElement(
            "span", "category", question.kategorija
        );

        const date = createElement(
            "span",
            "proposal-date",
            new Date(question.ustvarjeno).toLocaleString("sl-SI")
        );

        top.append(category, date);

        const message = createElement(
            "p", "proposal-text", question.vprasanje
        );

        const contact = createElement(
            "p",
            "proposal-contact",
            [question.ime, question.email]
                .filter(Boolean)
                .join(" · ") || "Anonimno"
        );

        const answerLabel = createElement(
            "label", "proposal-contact", "Damjanov odgovor"
        );

        const answerInput = document.createElement("textarea");
        answerInput.className = "answer-input";
        answerInput.rows = 5;
        answerInput.placeholder = "Napišite odgovor ...";
        answerInput.value = question.odgovor || "";

        const bottom = createElement("div", "proposal-bottom");

        const status = createElement(
            "span",
            "proposal-contact",
            question.objavljeno
                ? "Javno objavljeno"
                : question.odgovor
                    ? "Odgovor ni objavljen"
                    : "Novo vprašanje"
        );

        const saveButton = createElement(
            "button", "admin-action", "Shrani odgovor"
        );
        saveButton.type = "button";

        const publishButton = createElement(
            "button",
            "admin-action",
            question.objavljeno ? "Umakni objavo" : "Objavi odgovor"
        );
        publishButton.type = "button";

        saveButton.addEventListener("click", async () => {
            if (!await requireAal2()) {
                dashboardMessage.textContent =
                    "Za nadaljevanje ponovno potrdi prijavo.";
                await continueAuth();
                return;
            }

            const answer = answerInput.value.trim();

            if (!answer) {
                dashboardMessage.textContent =
                    "Najprej napišite odgovor.";
                return;
            }

            saveButton.disabled = true;

            try {
                const { data, error } = await db
                    .from("vprasanja")
                    .update({
                        odgovor: answer,
                        odgovorjeno: new Date().toISOString()
                    })
                    .eq("id", question.id)
                    .select("id, odgovor, odgovorjeno");

                if (error || !data || data.length !== 1) {
                    throw new Error("Odgovora ni bilo mogoče shraniti.");
                }

                question.odgovor = answer;
                question.odgovorjeno = data[0].odgovorjeno;
                dashboardMessage.textContent = "Odgovor je shranjen.";

                updateStats();
                renderQuestions();
            } catch (error) {
                dashboardMessage.textContent = error.message;
            } finally {
                saveButton.disabled = false;
            }
        });

        publishButton.addEventListener("click", async () => {
            if (!await requireAal2()) {
                dashboardMessage.textContent =
                    "Za nadaljevanje ponovno potrdi prijavo.";
                await continueAuth();
                return;
            }

            const publishing = !question.objavljeno;

            if (publishing && !question.odgovor) {
                dashboardMessage.textContent =
                    "Najprej shranite odgovor.";
                return;
            }

            if (
                publishing &&
                answerInput.value.trim() !== question.odgovor
            ) {
                dashboardMessage.textContent =
                    "Najprej shranite spremembe odgovora.";
                return;
            }

            publishButton.disabled = true;

            try {
                const { data, error } = await db
                    .from("vprasanja")
                    .update({ objavljeno: publishing })
                    .eq("id", question.id)
                    .select("id, objavljeno");

                if (error || !data || data.length !== 1) {
                    throw new Error("Sprememba objave ni uspela.");
                }

                question.objavljeno = publishing;

                dashboardMessage.textContent = publishing
                    ? "Odgovor je javno objavljen."
                    : "Odgovor je umaknjen.";

                updateStats();
                renderQuestions();
            } catch (error) {
                dashboardMessage.textContent = error.message;
            } finally {
                publishButton.disabled = false;
            }
        });

        const deleteButton = createElement(
            "button",
            "admin-action delete-question-button",
            "Izbriši vprašanje"
        );

        deleteButton.type = "button";

        deleteButton.addEventListener("click", async () => {
            const confirmed = confirm(
                "Ali res želite trajno izbrisati to vprašanje?\n\n" +
                question.vprasanje + "\n\n" +
                "Izbrisan bo tudi morebitni odgovor. " +
                "Tega dejanja ni mogoče razveljaviti."
            );

            if (!confirmed) return;

            deleteButton.disabled = true;
            dashboardMessage.textContent = "Brišem vprašanje ...";

            try {
                if (!await requireAal2()) {
                    throw new Error(
                        "Za brisanje je potrebna potrjena prijava z Authenticatorjem."
                    );
                }

                if (!await checkAdmin()) {
                    throw new Error("Nimate dovoljenja za brisanje vprašanj.");
                }

                const { data, error } = await db
                    .from("vprasanja")
                    .delete()
                    .eq("id", question.id)
                    .select("id");

                if (error) throw error;

                if (!data || data.length !== 1) {
                    throw new Error(
                        "Vprašanje ni bilo izbrisano. Preverite dovoljenja v Supabase."
                    );
                }

                questions = questions.filter(q => q.id !== question.id);

                updateStats();
                renderQuestions();

                dashboardMessage.textContent =
                    "Vprašanje je bilo uspešno in trajno izbrisano.";

            } catch (error) {
                dashboardMessage.textContent =
                    "Napaka pri brisanju: " + error.message;

                deleteButton.disabled = false;
            }
        });

        bottom.append(status, saveButton, publishButton, deleteButton);

        card.append(
            top,
            message,
            contact,
            answerLabel,
            answerInput,
            bottom
        );

        proposalsList.appendChild(card);
    });
}

// ============================================
// ADMINISTRACIJA - PREKLOP MED ZAVIHKI
// ============================================

const questionsView = $("questionsView");
const analyticsView = $("analyticsView");
const questionsNav = $("questionsNav");
const analyticsNav = $("analyticsNav");
const analyticsMessage = $("analyticsMessage");

function setAdminView(view) {
    const analytics = view === "analitika";

    questionsView.classList.toggle("hidden", analytics);
    analyticsView.classList.toggle("hidden", !analytics);

    questionsNav.classList.toggle("nav-active", !analytics);
    analyticsNav.classList.toggle("nav-active", analytics);

    if (analytics) {
        loadAnalytics();
    } else {
        analyticsRequestId++;
    }
}

questionsNav.addEventListener("click", event => {
    event.preventDefault();
    setAdminView("vprasanja");
});

analyticsNav.addEventListener("click", event => {
    event.preventDefault();
    setAdminView("analitika");
});

$("analyticsRefresh").addEventListener("click", loadAnalytics);

// ============================================
// ANALITIKA OBISKOV - POPRAVLJEN GRAF
// ============================================

function normalizeAnalyticsDays(rawDays) {
    if (!Array.isArray(rawDays)) {
        return [];
    }

    const byDate = new Map();

    for (const day of rawDays) {
        if (!day || typeof day.date !== "string") {
            continue;
        }

        const date = day.date.slice(0, 10);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            continue;
        }

        const visits = Number(day.visits);

        byDate.set(date, {
            date,
            visits: Number.isFinite(visits)
                ? Math.max(0, visits)
                : 0
        });
    }

    return [...byDate.values()]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7);
}

function renderAnalyticsChart(days) {
    const chart = $("analyticsChart");

    chart.replaceChildren();

    if (!days.length) {
        return;
    }

    const max = Math.max(
        1,
        ...days.map(day => day.visits)
    );

    for (const day of days) {
        const count = day.visits;

        const bar = createElement(
            "div",
            "analytics-bar"
        );

        const value = createElement(
            "span",
            "analytics-bar-value",
            count.toLocaleString("sl-SI")
        );

        const fill = createElement(
            "div",
            "analytics-bar-fill"
        );

        const label = createElement(
            "span",
            "analytics-bar-label",
            day.date.slice(5)
        );

        fill.style.height =
            `${Math.max(2, (count / max) * 130)}px`;

        bar.append(value, fill, label);
        chart.appendChild(bar);
    }
}

async function loadAnalytics() {
    const requestId = ++analyticsRequestId;

    try {
        if (!await requireAal2()) {
            if (requestId === analyticsRequestId) {
                await continueAuth();
            }
            return;
        }

        if (requestId !== analyticsRequestId) {
            return;
        }

        analyticsMessage.textContent =
            "Nalagam statistiko ...";

        const ids = [
            "visitsToday",
            "visitsWeek",
            "visitsMonth",
            "pageViewsMonth"
        ];

        for (const id of ids) {
            $(id).textContent = "—";
        }

        $("analyticsChart").replaceChildren();

        const { data, error } = await db.functions.invoke(
            "analytics-stats",
            {
                method: "POST",
                body: {}
            }
        );

        if (requestId !== analyticsRequestId) {
            return;
        }

        if (error) {
            let detail = error.message ||
                "Neznana napaka";

            if (error.context?.json) {
                try {
                    const payload =
                        await error.context.json();

                    detail =
                        payload?.error ||
                        payload?.message ||
                        detail;
                } catch (_) {
                    // Odgovor ni v formatu JSON.
                }
            }

            throw new Error(detail);
        }

        if (data?.ok === true) {
            for (const id of ids) {
                const value = Number(data[id]);

                $(id).textContent =
                    data[id] !== null &&
                        data[id] !== undefined &&
                        Number.isFinite(value)
                        ? value.toLocaleString("sl-SI")
                        : "—";
            }

            const days = normalizeAnalyticsDays(
                data.days
            );

            renderAnalyticsChart(days);

            analyticsMessage.textContent =
                days.length > 0
                    ? ""
                    : "Za graf še ni podatkov.";

        } else if (data?.success === true) {
            analyticsMessage.textContent =
                "Povezava s Cloudflare deluje. " +
                "Za prikaz številk je treba še urediti " +
                "izračun statistike v Edge Function.";
        } else {
            throw new Error(
                data?.error ||
                "Podatki niso na voljo."
            );
        }

    } catch (error) {
        if (requestId !== analyticsRequestId) {
            return;
        }

        analyticsMessage.textContent =
            "Napaka pri nalaganju analitike: " +
            error.message;
    }
}

continueAuth();
