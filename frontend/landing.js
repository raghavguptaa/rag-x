(function () {
    document.documentElement.classList.add("js");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    /* ---------- navbar, progress bar, steps line ---------- */
    const nav = $("#nav");
    const prog = $("#progress");
    const stepsBox = $("#steps");
    const fill = $("#stepsFill");
    const steps = $$(".step");

    function updateSteps() {
        if (!stepsBox) return;
        const r = stepsBox.getBoundingClientRect();
        const trigger = window.innerHeight * 0.65;
        const p = Math.max(0, Math.min(1, (trigger - r.top) / r.height));
        fill.style.height = (p * 100) + "%";
        steps.forEach(function (s) {
            s.classList.toggle("active", s.getBoundingClientRect().top < trigger);
        });
    }

    function onScroll() {
        const y = window.scrollY;
        nav.classList.toggle("scrolled", y > 20);
        const h = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
        updateSteps();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    /* ---------- mobile menu ---------- */
    const toggle = $("#menuToggle");
    const menu = $("#navMenu");
    toggle.addEventListener("click", function () { menu.classList.toggle("open"); });
    menu.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { menu.classList.remove("open"); });
    });

    /* ---------- scroll reveal ---------- */
    const revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            const el = e.target;
            const delay = parseInt(el.dataset.delay || "0", 10);
            setTimeout(function () { el.classList.add("visible"); }, delay);
            revealObserver.unobserve(el);
        });
    }, { threshold: 0.15 });
    $$(".reveal").forEach(function (el) { revealObserver.observe(el); });

    /* ---------- number counters ---------- */
    function animateCount(el) {
        const target = parseFloat(el.dataset.count);
        if (reduce) { el.textContent = target.toLocaleString("en-US"); return; }
        const start = performance.now();
        const duration = 1600;
        function tick(now) {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased).toLocaleString("en-US");
            if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }
    const countObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) {
                animateCount(e.target);
                countObserver.unobserve(e.target);
            }
        });
    }, { threshold: 0.6 });
    $$("[data-count]").forEach(function (el) { countObserver.observe(el); });

    /* ---------- typing effect ---------- */
    const typed = $("#typed");
    const words = ["messages", "files", "PDFs", "secrets"];
    if (typed && !reduce) {
        let wi = 0, ci = 0, deleting = false;
        (function type() {
            const w = words[wi];
            typed.textContent = w.slice(0, ci);
            if (!deleting && ci < w.length) { ci++; setTimeout(type, 90); }
            else if (!deleting) { deleting = true; setTimeout(type, 1400); }
            else if (ci > 0) { ci--; setTimeout(type, 45); }
            else { deleting = false; wi = (wi + 1) % words.length; setTimeout(type, 300); }
        })();
    }

    /* ---------- card spotlight + tilt ---------- */
    $$(".f-card").forEach(function (card) {
        card.addEventListener("mousemove", function (e) {
            const r = card.getBoundingClientRect();
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;
            card.style.setProperty("--mx", x + "px");
            card.style.setProperty("--my", y + "px");
            if (!reduce && card.classList.contains("visible")) {
                const rx = ((y / r.height) - 0.5) * -8;
                const ry = ((x / r.width) - 0.5) * 8;
                card.style.transform =
                    "perspective(800px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateY(-4px)";
            }
        });
        card.addEventListener("mouseleave", function () { card.style.transform = ""; });
    });

    /* ---------- particle network background ---------- */
    const cv = $("#bg-canvas");
    if (cv && !reduce) {
        const ctx = cv.getContext("2d");
        let w = 0, h = 0, pts = [];
        const mouse = { x: -999, y: -999 };

        function resize() {
            const r = cv.parentElement.getBoundingClientRect();
            w = cv.width = r.width;
            h = cv.height = r.height;
            const n = Math.min(90, Math.floor((w * h) / 16000));
            pts = [];
            for (let i = 0; i < n; i++) {
                pts.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.35,
                    vy: (Math.random() - 0.5) * 0.35
                });
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(167,139,250,.8)";
                ctx.fill();

                for (let j = i + 1; j < pts.length; j++) {
                    const q = pts[j];
                    const d = Math.hypot(p.x - q.x, p.y - q.y);
                    if (d < 120) {
                        ctx.strokeStyle = "rgba(139,92,246," + (0.18 * (1 - d / 120)) + ")";
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.stroke();
                    }
                }

                const md = Math.hypot(p.x - mouse.x, p.y - mouse.y);
                if (md < 150) {
                    ctx.strokeStyle = "rgba(34,211,238," + (0.4 * (1 - md / 150)) + ")";
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }
            requestAnimationFrame(draw);
        }

        cv.parentElement.addEventListener("mousemove", function (e) {
            const r = cv.getBoundingClientRect();
            mouse.x = e.clientX - r.left;
            mouse.y = e.clientY - r.top;
        });
        cv.parentElement.addEventListener("mouseleave", function () { mouse.x = mouse.y = -999; });

        window.addEventListener("resize", resize);
        resize();
        draw();
    }
})();
/* ---------- live encryption demo ---------- */
(function () {
    const input = document.getElementById("demoInput");
    const out = document.getElementById("demoOut");
    const meta = document.getElementById("demoMeta");
    if (!input || !out || !meta) return;

    if (!window.crypto || !crypto.subtle) {
        meta.textContent = "Demo needs HTTPS or localhost";
        return;
    }

    // non-extractable key: it exists only inside the browser's crypto engine
    const keyPromise = crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    let timer;

    function toBase64(buf) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
    }

    async function run() {
        const text = input.value;
        if (!text) {
            out.textContent = "";
            meta.textContent = "Waiting for input";
            return;
        }
        const key = await keyPromise;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(text));
        out.textContent = toBase64(ct);
        meta.textContent = "AES-256-GCM \u2022 " + ct.byteLength + " bytes \u2022 fresh IV";
    }

    input.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(run, 120);
    });
    run();
})();