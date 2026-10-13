(function () {
    "use strict";

    function $(id) { return document.getElementById(id); }

    function csrfToken() {
        return fetch("/api/csrf", { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (d) { return d.token; });
    }

    function post(url, payload) {
        return csrfToken()
            .then(function (t) {
                return fetch(url, {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json", "X-CSRF-Token": t },
                    body: JSON.stringify(payload)
                });
            })
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (data) {
                    return { ok: r.ok, status: r.status, data: data };
                });
            })
            .catch(function () {
                return { ok: false, status: 0, data: { error: "Could not reach the server." } };
            });
    }

    /* ---------- forgot password page ---------- */
    var forgot = $("forgotForm");
    if (forgot) {
        forgot.addEventListener("submit", function (e) {
            e.preventDefault();
            $("formError").textContent = "";
            var email = $("email").value.trim();
            if (!email) { $("formError").textContent = "Enter your email address."; return; }

            var btn = $("submitBtn");
            btn.disabled = true;
            btn.textContent = "Please wait...";
            post("/api/forgot", { email: email }).then(function (res) {
                if (res.ok) {
                    forgot.hidden = true;
                    $("formOk").textContent = res.data.message || "If an account exists, a reset link has been sent.";
                    $("okBox").hidden = false;
                } else {
                    btn.disabled = false;
                    btn.textContent = "Send reset link";
                    $("formError").textContent = res.data.error || "Something went wrong.";
                }
            });
        });
    }

    /* ---------- reset password page ---------- */
    var reset = $("resetForm");
    if (reset) {
        // the token travels in the URL fragment, which browsers never send to the server
        var m = /token=([A-Za-z0-9_\-]+)/.exec(window.location.hash || "");
        var token = m ? m[1] : "";
        if (window.history && history.replaceState) history.replaceState(null, "", window.location.pathname);

        if (!token) {
            reset.hidden = true;
            $("badLink").hidden = false;
        } else {
            var pw = $("password");
            var bar = $("meterBar");
            var hint = $("pwHint");

            var score = function (p) {
                var s = 0;
                if (p.length >= 10) s++;
                if (p.length >= 14) s++;
                if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
                if (/\d/.test(p)) s++;
                if (/[^A-Za-z0-9]/.test(p)) s++;
                return s;
            };

            pw.addEventListener("input", function () {
                var p = pw.value;
                if (!p) { bar.style.width = "0"; hint.textContent = ""; return; }
                var s = score(p);
                var color = "#ef4444", text = "Weak: use at least 10 characters";
                if (s >= 4) { color = "#22c55e"; text = "Strong password"; }
                else if (s >= 2) { color = "#f59e0b"; text = "Medium: add length, numbers or symbols"; }
                bar.style.width = (s / 5) * 100 + "%";
                bar.style.background = color;
                hint.textContent = text;
            });

            reset.addEventListener("submit", function (e) {
                e.preventDefault();
                $("formError").textContent = "";
                var password = pw.value;
                if (password.length < 10) { $("formError").textContent = "Password must be at least 10 characters."; return; }
                if (password !== $("confirm").value) { $("formError").textContent = "Passwords do not match."; return; }

                var btn = $("submitBtn");
                btn.disabled = true;
                btn.textContent = "Please wait...";
                post("/api/reset", { token: token, password: password }).then(function (res) {
                    if (res.ok) {
                        reset.hidden = true;
                        $("doneBox").hidden = false;
                    } else {
                        btn.disabled = false;
                        btn.textContent = "Set new password";
                        $("formError").textContent = res.data.error || "Something went wrong.";
                    }
                });
            });
        }
    }
})();