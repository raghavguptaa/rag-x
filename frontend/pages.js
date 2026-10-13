(function () {
    document.documentElement.classList.add("js");

    /* scroll reveal */
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            var el = e.target;
            var d = parseInt(el.dataset.delay || "0", 10);
            setTimeout(function () { el.classList.add("visible"); }, d);
            io.unobserve(el);
        });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

    /* cursor glow on cards */
    document.querySelectorAll(".f-card, .c-link").forEach(function (card) {
        card.addEventListener("mousemove", function (e) {
            var r = card.getBoundingClientRect();
            card.style.setProperty("--mx", (e.clientX - r.left) + "px");
            card.style.setProperty("--my", (e.clientY - r.top) + "px");
        });
    });

    /* contact form: saves the message to the Rag X inbox */
    var form = document.getElementById("contactForm");
    if (!form) return;

    var note = document.getElementById("formNote");
    var btn = document.getElementById("sendBtn");

    function say(text, cls) {
        note.textContent = text;
        note.className = "form-note" + (cls ? " " + cls : "");
    }

    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var message = document.getElementById("cMsg").value.trim();
        if (message.length < 10) return say("Please write at least 10 characters.", "err");

        btn.disabled = true;
        btn.textContent = "Sending...";
        try {
            var t = await fetch("/api/csrf", { credentials: "same-origin" })
                .then(function (r) { return r.json(); });

            var res = await fetch("/api/contact", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": t.token },
                body: JSON.stringify({
                    name: document.getElementById("cName").value,
                    email: document.getElementById("cEmail").value,
                    topic: document.getElementById("cTopic").value,
                    message: message,
                    hp: document.getElementById("cHp").value
                })
            });

            var data = {};
            try { data = await res.json(); } catch (x) {}

            if (res.ok) {
                form.reset();
                say("Thanks! Your message has been sent.", "ok");
            } else {
                say(data.error || "Could not send your message. Please try again.", "err");
            }
        } catch (x) {
            say("Could not reach the server. Please try again.", "err");
        }
        btn.disabled = false;
        btn.textContent = "Send message";
    });
})();