(function () {
    var tabs = document.querySelector("#navMenu .tabs");
    if (!tabs) return;

    fetch("/api/me", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (u) {
            if (!u || !u.is_admin) return;

            var a = document.createElement("a");
            a.href = "/admin.html";
            a.className = "nav-inbox" + (window.location.pathname === "/admin.html" ? " current" : "");
            a.appendChild(document.createTextNode("Inbox"));

            var badge = document.createElement("span");
            badge.className = "inbox-badge";
            badge.hidden = true;
            a.appendChild(badge);
            tabs.appendChild(a);

            return fetch("/api/admin/unread", { credentials: "same-origin" })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (d) {
                    if (d && d.unread > 0) {
                        badge.textContent = d.unread > 99 ? "99+" : String(d.unread);
                        badge.hidden = false;
                    }
                });
        })
        .catch(function () {});
})();