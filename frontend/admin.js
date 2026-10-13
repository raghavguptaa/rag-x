(function () {
    var list = document.getElementById("list");
    var summary = document.getElementById("summary");
    var filter = "all";
    var messages = [];

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;   // textContent keeps visitor text harmless
        return n;
    }

    async function api(method, url, body) {
        var t = await fetch("/api/csrf", { credentials: "same-origin" }).then(function (r) { return r.json(); });
        var opts = { method: method, credentials: "same-origin", headers: { "X-CSRF-Token": t.token } };
        if (body) {
            opts.headers["Content-Type"] = "application/json";
            opts.body = JSON.stringify(body);
        }
        return fetch(url, opts);
    }

    function card(m) {
        var c = el("article", "msg" + (m.read ? "" : " unread"));

        var top = el("div", "msg-top");
        top.appendChild(el("span", "topic-pill", m.topic));
        top.appendChild(el("span", "msg-date", new Date(m.created_at).toLocaleString()));
        c.appendChild(top);

        var who = el("div", "msg-who");
        who.appendChild(el("b", "", m.name || "Anonymous"));
        if (m.email) {
            var a = el("a", "", m.email);
            a.href = "mailto:" + m.email + "?subject=" + encodeURIComponent("Re: [Rag X] " + m.topic);
            who.appendChild(a);
        } else {
            who.appendChild(el("span", "muted", "no reply address given"));
        }
        c.appendChild(who);

        c.appendChild(el("p", "msg-body", m.body));

        var actions = el("div", "msg-actions");

        var toggle = el("button", "mini", m.read ? "Mark unread" : "Mark read");
        toggle.addEventListener("click", async function () {
            var r = await api("POST", "/api/admin/messages/" + m.id + "/read", { read: !m.read });
            if (r.ok) { m.read = !m.read; render(); }
        });

        var del = el("button", "mini danger", "Delete");
        del.addEventListener("click", async function () {
            if (!window.confirm("Delete this message permanently?")) return;
            var r = await api("DELETE", "/api/admin/messages/" + m.id);
            if (r.ok) {
                messages = messages.filter(function (x) { return x.id !== m.id; });
                render();
            }
        });

        actions.appendChild(toggle);
        actions.appendChild(del);
        c.appendChild(actions);
        return c;
    }

    function render() {
        var unread = messages.filter(function (m) { return !m.read; }).length;
        summary.textContent = messages.length + " messages, " + unread + " unread";

        list.textContent = "";
        var shown = messages.filter(function (m) { return filter === "all" || !m.read; });

        if (!shown.length) {
            list.appendChild(el("p", "empty-state", filter === "unread" ? "No unread messages." : "No messages yet."));
            return;
        }
        shown.forEach(function (m) { list.appendChild(card(m)); });
    }

    async function load() {
        var r = await fetch("/api/admin/messages", { credentials: "same-origin" });
        if (r.status === 401) { window.location.href = "/login.html"; return; }
        if (!r.ok) { window.location.href = "/"; return; }
        var data = await r.json();
        messages = data.messages;
        render();
    }

    document.querySelectorAll(".chip-btn").forEach(function (b) {
        b.addEventListener("click", function () {
            document.querySelectorAll(".chip-btn").forEach(function (x) { x.classList.remove("active"); });
            b.classList.add("active");
            filter = b.dataset.filter;
            render();
        });
    });

    load();
})();