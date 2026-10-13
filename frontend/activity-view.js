(function () {
    var bars = document.getElementById("bars");
    if (!bars) return;

    var NAMES = {
        text: "Text Cipher", file: "File Cipher", vault: "Password Vault",
        pdf: "PDF Protection", password: "Password Generator", hash: "Hash Checker"
    };
    var VERBS = {
        encrypt: "Encrypted", decrypt: "Decrypted", lock: "Locked",
        unlock: "Unlocked", generate: "Generated a password", hash: "Hashed"
    };

    function $(id) { return document.getElementById(id); }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }

    function fmtBytes(n) {
        if (n < 1024) return n + " B";
        if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
        if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
        return (n / 1073741824).toFixed(1) + " GB";
    }

    function ago(iso) {
        var s = (Date.now() - new Date(iso).getTime()) / 1000;
        if (s < 60) return "just now";
        if (s < 3600) return Math.floor(s / 60) + " min ago";
        if (s < 86400) return Math.floor(s / 3600) + " h ago";
        return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    }

    function grow(fn) {
        requestAnimationFrame(function () { requestAnimationFrame(fn); });
    }

    function render(d) {
        $("sTotal").textContent = d.total.toLocaleString();
        $("sWeek").textContent = d.last7.toLocaleString();
        $("sTop").textContent = d.top_tool ? (NAMES[d.top_tool] || d.top_tool) : "-";
        $("sBytes").textContent = fmtBytes(d.bytes);

        /* 14-day chart */
        bars.textContent = "";
        var max = Math.max.apply(null, d.per_day.map(function (x) { return x.count; }).concat([1]));
        d.per_day.forEach(function (day) {
            var col = el("div", "bar-col");
            col.title = day.date + ": " + day.count;
            if (day.count) col.appendChild(el("span", "bar-count", String(day.count)));
            var bar = el("div", "bar" + (day.count ? "" : " zero"));
            col.appendChild(bar);
            col.appendChild(el("span", "bar-label", String(parseInt(day.date.slice(8), 10))));
            bars.appendChild(col);
            grow(function () { bar.style.height = (day.count / max * 85) + "%"; });
        });

        /* per-tool bars */
        var tb = $("toolBars");
        tb.textContent = "";
        if (!d.by_tool.length) tb.appendChild(el("p", "empty", "No activity yet."));
        var tmax = d.by_tool.length ? d.by_tool[0].count : 1;
        d.by_tool.forEach(function (t) {
            var row = el("div", "tb-row");
            var top = el("div", "tb-top");
            top.appendChild(el("span", "", NAMES[t.tool] || t.tool));
            top.appendChild(el("span", "", String(t.count)));
            var track = el("div", "tb-track");
            var fill = el("div", "tb-fill");
            track.appendChild(fill);
            row.appendChild(top);
            row.appendChild(track);
            tb.appendChild(row);
            grow(function () { fill.style.width = (t.count / tmax * 100) + "%"; });
        });

        /* timeline */
        var tl = $("timeline");
        tl.textContent = "";
        if (!d.recent.length) {
            tl.appendChild(el("li", "tl-empty", "Nothing here yet. Use a tool while signed in and it will appear here."));
        }
        d.recent.forEach(function (r) {
            var li = el("li", "tl-item");
            li.appendChild(el("span", "tl-dot"));
            li.appendChild(el("b", "", NAMES[r.tool] || r.tool));
            li.appendChild(el("span", "tl-meta",
                (VERBS[r.action] || r.action) + (r.size ? " \u2022 " + fmtBytes(r.size) : "")));
            li.appendChild(el("span", "tl-time", ago(r.at)));
            tl.appendChild(li);
        });
    }

    function load() {
        var tz = -new Date().getTimezoneOffset();
        fetch("/api/activity/summary?tz=" + tz, { credentials: "same-origin" })
            .then(function (r) {
                if (r.status === 401) { window.location.href = "/login.html"; return null; }
                return r.json();
            })
            .then(function (d) { if (d) render(d); })
            .catch(function () {});
    }

    /* pause tracking (remembered in this browser only) */
    var pauseBtn = $("pauseBtn");
    function paused() {
        try { return localStorage.getItem("ragx_pause_tracking") === "1"; } catch (e) { return false; }
    }
    function syncPause() {
        pauseBtn.textContent = paused() ? "Resume tracking" : "Pause tracking";
        pauseBtn.classList.toggle("on", paused());
    }
    pauseBtn.addEventListener("click", function () {
        try {
            if (paused()) localStorage.removeItem("ragx_pause_tracking");
            else localStorage.setItem("ragx_pause_tracking", "1");
        } catch (e) {}
        syncPause();
    });
    syncPause();

    /* delete the whole history */
    $("clearBtn").addEventListener("click", function () {
        if (!window.confirm("Delete your whole activity history? This cannot be undone.")) return;
        fetch("/api/csrf", { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (t) {
                return fetch("/api/activity", {
                    method: "DELETE",
                    credentials: "same-origin",
                    headers: { "X-CSRF-Token": t.token }
                });
            })
            .then(function (r) { if (r.ok) load(); })
            .catch(function () {});
    });

    load();
})();