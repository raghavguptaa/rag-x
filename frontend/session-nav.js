(function () {
    const links = document.querySelectorAll("[data-signin-link]");
    if (!links.length) return;

    fetch("/api/me", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (u) {
            if (!u) return;
            links.forEach(function (a) {
                a.href = "/dashboard.html";
                a.title = "Dashboard (" + u.email + ")";
                a.className = "nav-avatar";
                a.textContent = u.email.charAt(0).toUpperCase();
            });
        })
        .catch(function () {});
})();