(function () {
    var userRows = document.getElementById("userRows");
    if (!userRows) return;

    function $(id) { return document.getElementById(id); }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }

    function grow(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }

    /* tabs: Messages / Users */
    document.querySelectorAll(".admin-tab").forEach(function (t) {
        t.addEventListener("click", function () {
            document.querySelectorAll(".admin-tab").forEach(function (x) { x.classList.remove("active"); });
            t.classList.add("active");
            ["paneMessages", "paneUsers"].forEach(function (id) { $(id).hidden = id !== t.dataset.pane; });
        });
    });

    fetch("/api/admin/stats", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (s) {
            if (!s) return;
            $("stUsers").textContent = s.total_users;
            $("stNew").textContent = s.new_7d;
            $("stActive").textContent = s.active_7d;
            $("stMsgs").textContent = s.messages;
            $("stMsgsLabel").textContent = "Messages (" + s.unread + " unread)";

            var bars = $("signBars");
            bars.textContent = "";
            var max = Math.max.apply(null, s.signups.map(function (x) { return x.count; }).concat([1]));
            s.signups.forEach(function (day) {
                var col = el("div", "bar-col");
                col.title = day.date + ": " + day.count;
                if (day.count) col.appendChild(el("span", "bar-count", String(day.count)));
                var bar = el("div", "bar" + (day.count ? "" : " zero"));
                col.appendChild(bar);
                col.appendChild(el("span", "bar-label", String(parseInt(day.date.slice(8), 10))));
                bars.appendChild(col);
                grow(function () { bar.style.height = (day.count / max * 85) + "%"; });
            });
        })
        .catch(function () {});

    fetch("/api/admin/users", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
            if (!d) return;
            userRows.textContent = "";
            if (!d.users.length) {
                var tr0 = el("tr");
                var td0 = el("td", "muted", "No registered users yet.");
                td0.colSpan = 3;
                tr0.appendChild(td0);
                userRows.appendChild(tr0);
                return;
            }
            d.users.forEach(function (u) {
                var tr = el("tr");
                tr.appendChild(el("td", "", u.email));
                tr.appendChild(el("td", "muted", new Date(u.created_at).toLocaleDateString(
                    undefined, { year: "numeric", month: "short", day: "numeric" })));
                tr.appendChild(el("td", "num", String(u.ops)));
                userRows.appendChild(tr);
            });
        })
        .catch(function () {});
})();