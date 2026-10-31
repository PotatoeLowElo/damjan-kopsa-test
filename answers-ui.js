// Skupni predstavitveni elementi javnih odgovorov; brez dostopa do podatkov.
window.AnswersUI = (() => {
    let nextId = 0;
    let returnFocus;
    const element = (tag, className, text) => {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const dialog = element("dialog", "answer-dialog qa-dialog");
    const close = element("button", "answer-dialog-close", "Zapri ×");
    close.type = "button";
    close.autofocus = true;
    const title = element("h2", "qa-dialog-question");
    title.id = "qa-dialog-question";
    dialog.setAttribute("aria-labelledby", title.id);
    const label = element("p", "qa-dialog-label", "DAMJANOV ODGOVOR");
    const text = element("p", "answer-dialog-text");
    dialog.append(close, title, label, text);
    document.body.appendChild(dialog);
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        if (returnFocus?.isConnected) returnFocus.focus();
    });
    dialog.addEventListener("click", event => {
        const bounds = dialog.getBoundingClientRect();
        if (event.target === dialog &&
            (event.clientX < bounds.left || event.clientX > bounds.right ||
             event.clientY < bounds.top || event.clientY > bounds.bottom)) {
            dialog.close();
        }
    });

    function createCard(item) {
        const question = String(item.vprasanje || "");
        const answer = String(item.odgovor || "");
        const card = element("article", "flip-card qa-card");
        const inner = element("div", "flip-card-inner");
        const front = element("div", "flip-card-front");
        const heading = element("h3", "flip-question", question);
        heading.id = `qa-question-${++nextId}`;
        card.setAttribute("aria-labelledby", heading.id);
        front.append(element("span", "flip-label", item.kategorija || "VPRAŠANJE"), heading,
            element("span", "flip-hint", "Vprašanje občana"));
        const back = element("div", "flip-card-back");
        back.id = `qa-answer-${nextId}`;
        back.setAttribute("role", "region");
        back.setAttribute("aria-label", "Damjanov odgovor");
        back.setAttribute("aria-hidden", "true");
        back.inert = true;
        const preview = answer.length > 260 ? answer.slice(0, 260).trimEnd() + "…" : answer;
        back.append(element("span", "flip-label", "DAMJANOV ODGOVOR"),
            element("p", "flip-answer", preview),
            element("span", "flip-hint", answer.length > 260
                ? "Nadaljevanje v celotnem odgovoru." : "Preberite tudi celoten odgovor z vprašanjem."));
        inner.append(front, back);

        const actions = element("div", "qa-actions");
        const toggle = element("button", "qa-toggle", "Pokaži odgovor ↻");
        toggle.type = "button";
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", back.id);
        toggle.addEventListener("click", () => {
            const flipped = card.classList.toggle("flipped");
            toggle.setAttribute("aria-expanded", String(flipped));
            toggle.textContent = flipped ? "Nazaj na vprašanje ↻" : "Pokaži odgovor ↻";
            front.setAttribute("aria-hidden", String(flipped));
            front.inert = flipped;
            back.setAttribute("aria-hidden", String(!flipped));
            back.inert = !flipped;
        });
        const full = element("button", "answer-read-more", "Celoten odgovor →");
        full.type = "button";
        full.setAttribute("aria-haspopup", "dialog");
        full.addEventListener("click", () => {
            title.textContent = question;
            text.textContent = answer;
            returnFocus = full;
            dialog.showModal();
        });
        actions.append(toggle, full);
        card.append(inner, actions);
        return card;
    }

    function message(titleText, detailText) {
        const panel = element("div", "qa-state");
        panel.append(element("h3", "qa-state-title", titleText),
            element("p", "qa-state-detail", detailText));
        return panel;
    }

    return { createCard, message };
})();
