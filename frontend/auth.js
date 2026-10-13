(function () {
    const $ = (id) => document.getElementById(id);
        /* already signed in? go straight to the dashboard */
    if ($("loginForm") || $("registerForm")) {
        fetch("/api/me", { credentials: "same-origin" })
            .then(function (r) { if (r.ok) window.location.replace("/dashboard.html"); })
            .catch(function () {});
    }

    async function csrfToken() {
        const r = await fetch("/api/csrf", { credentials: "same-origin" });
        const d = await r.json();
        return d.token;
    }

    async function post(url, body) {
        try {
            const token = await csrfToken();
            const r = await fetch(url, {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
                body: JSON.stringify(body || {})
            });
            let data = {};
            try { data = await r.json(); } catch (e) {}
            return { ok: r.ok, status: r.status, data: data };
        } catch (e) {
            return { ok: false, status: 0, data: { error: "Could not reach the server." } };
        }
    }

    function setError(msg) {
        const el = $("formError");
        if (el) el.textContent = msg || "";
    }

    function busy(btn, on, label) {
        btn.disabled = on;
        btn.textContent = on ? "Please wait..." : label;
    }

    /* show / hide password */
    document.querySelectorAll(".pw-toggle").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const input = $(this.dataset.target);
            const hidden = input.type === "password";
            input.type = hidden ? "text" : "password";
            this.textContent = hidden ? "Hide" : "Show";
        });
    });

    /* ---------- sign in ---------- */
    const loginForm = $("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            setError("");
            const email = $("email").value.trim();
            const password = $("password").value;
            if (!email || !password) return setError("Enter your email and password.");

            const btn = $("submitBtn");
            busy(btn, true, "Sign in");
            const res = await post("/api/login", { email: email, password: password });
            if (res.ok) { window.location.href = "/dashboard.html"; return; }
            busy(btn, false, "Sign in");
            setError(res.data.error || "Sign in failed.");
        });
    }

    /* ---------- register ---------- */
    const registerForm = $("registerForm");
    if (registerForm) {
        const pw = $("password");
        const bar = $("meterBar");
        const hint = $("pwHint");

        function score(p) {
            let s = 0;
            if (p.length >= 10) s++;
            if (p.length >= 14) s++;
            if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
            if (/\d/.test(p)) s++;
            if (/[^A-Za-z0-9]/.test(p)) s++;
            return s;
        }

        pw.addEventListener("input", function () {
            const p = pw.value;
            if (!p) { bar.style.width = "0"; hint.textContent = ""; return; }
            const s = score(p);
            let color = "#ef4444", text = "Weak: use at least 10 characters";
            if (s >= 4) { color = "#22c55e"; text = "Strong password"; }
            else if (s >= 2) { color = "#f59e0b"; text = "Medium: add length, numbers or symbols"; }
            bar.style.width = (s / 5) * 100 + "%";
            bar.style.background = color;
            hint.textContent = text;
        });

        registerForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            setError("");
            const email = $("email").value.trim();
            const password = pw.value;
            const confirm = $("confirm").value;

            if (!email) return setError("Enter your email address.");
            if (password.length < 10) return setError("Password must be at least 10 characters.");
            if (password !== confirm) return setError("Passwords do not match.");

            const btn = $("submitBtn");
            busy(btn, true, "Create account");
            const res = await post("/api/register", { email: email, password: password });
            if (res.ok) { window.location.href = "/dashboard.html"; return; }
            busy(btn, false, "Create account");
            setError(res.data.error || "Could not create the account.");
        });
    }

    /* ---------- dashboard ---------- */
    const logoutBtn = $("logoutBtn");
    if (logoutBtn) {
        (async function () {
            try {
                const r = await fetch("/api/me", { credentials: "same-origin" });
                if (r.status === 401) { window.location.href = "/login.html"; return; }
                const u = await r.json();
                $("avatar").textContent = u.email.charAt(0).toUpperCase();
                $("welcome").textContent = "Signed in as " + u.email;
                $("userEmail").textContent = u.email;
                if (u.is_admin) $("inboxLink").hidden = false;
                $("memberSince").textContent = new Date(u.created_at).toLocaleDateString(
                    undefined, { year: "numeric", month: "long", day: "numeric" }
                );
            } catch (e) {
                $("welcome").textContent = "Could not load your account.";
            }
        })();

        logoutBtn.addEventListener("click", async function () {
            await post("/api/logout");
            window.location.href = "/login.html";

            
        });
    }
})();