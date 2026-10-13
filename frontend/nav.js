(function () {
    const header = document.getElementById("nav");
    if (!header) return;

    const path = window.location.pathname;
    const onHome = path === "/" || path === "/index.html";
    // on the home page, landing.js handles the menu button and the scroll bar
    const ownsBehavior = !document.getElementById("progress");

    const tabs = [
        ["Home", "/", "home"],
        ["Features", "/#features", "features"],
        ["How it works", "/#how", "how"],
        ["About", "/about.html", ""],
        ["Contact", "/contact.html", ""]
    ];

    const links = tabs.map(function (t) {
        const cls = (!onHome && t[1] === path) ? "current" : "";
        const key = t[2] ? ' data-key="' + t[2] + '"' : "";
        return '<a href="' + t[1] + '"' + key + ' class="' + cls + '">' + t[0] + "</a>";
    }).join("");

    header.innerHTML =
        '<a href="/" class="brand">' +
            '<svg class="brand-icon" viewBox="0 0 32 32" aria-hidden="true">' +
                '<path d="M16 2.5 5 6.8v8.2c0 6.6 4.5 11.5 11 14.5 6.5-3 11-7.9 11-14.5V6.8L16 2.5z" fill="#8b5cf6"/>' +
                '<circle cx="16" cy="13.5" r="3.4" fill="#07060f"/>' +
                '<path d="M14.4 15.8h3.2l.9 6.2h-5z" fill="#07060f"/>' +
            "</svg>" +
            '<span class="brand-name">Rag <b>X</b></span>' +
        "</a>" +
        '<button class="menu-toggle" id="menuToggle" aria-label="Menu">&#9776;</button>' +
        '<nav class="nav-menu" id="navMenu">' +
            '<div class="tabs">' + links + "</div>" +
            '<div class="nav-actions">' +
                '<a href="/login.html" id="navAuth" class="btn btn-ghost btn-sm">Sign in</a>' +
                '<a href="/app.html" class="btn btn-sm">Toolkit</a>' +
            "</div>" +
        "</nav>";

    const menu = document.getElementById("navMenu");

    if (ownsBehavior) {
        document.getElementById("menuToggle").addEventListener("click", function () {
            menu.classList.toggle("open");
        });
        menu.querySelectorAll("a").forEach(function (a) {
            a.addEventListener("click", function () { menu.classList.remove("open"); });
        });
        const onScrollNav = function () { header.classList.toggle("scrolled", window.scrollY > 20); };
        window.addEventListener("scroll", onScrollNav, { passive: true });
        onScrollNav();
    }

    if (onHome) {
        const keys = ["home", "features", "how"];
        const linkFor = {};
        menu.querySelectorAll("[data-key]").forEach(function (a) { linkFor[a.dataset.key] = a; });
                const elFor = {
            home: document.querySelector(".hero-section"),
            features: document.getElementById("features"),
            how: document.getElementById("how")
        };

        function setCurrent(key) {
            keys.forEach(function (k) {
                if (linkFor[k]) linkFor[k].classList.toggle("current", k === key);
            });
        }
        setCurrent("home");

        const spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) setCurrent(e.target.dataset.spy);
            });
        }, { rootMargin: "-40% 0px -55% 0px" });

        keys.forEach(function (k) {
            const el = elFor[k];
            if (el) { el.dataset.spy = k; spy.observe(el); }
        });

        if (linkFor.home) {
            linkFor.home.addEventListener("click", function (e) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        }
    }

    const auth = document.getElementById("navAuth");
    fetch("/api/me", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (u) {
            if (!u) return;
            auth.href = "/dashboard.html";
            auth.title = "Dashboard (" + u.email + ")";
            var local = u.email.split("@")[0];
            var shown = local.length > 8 ? local.slice(0, 8) + "\u2026" : local;
            auth.className = "nav-user";
            auth.textContent = "";
            var dot = document.createElement("span");
            dot.className = "nav-user-dot";
            var nm = document.createElement("span");
            nm.textContent = shown;
            auth.appendChild(dot);
            auth.appendChild(nm);
        })
        .catch(function () {});

    // load the page-wide background separately, so a problem there can never break the menu
    const bg = document.createElement("script");
    bg.src = "/bg.js";
    bg.async = true;
    document.body.appendChild(bg);
    const an = document.createElement("script");
    an.src = "/admin-nav.js";
    an.async = true;
    document.body.appendChild(an);
})();