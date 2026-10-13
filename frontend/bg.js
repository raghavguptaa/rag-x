(function () {
    if (document.querySelector(".bg-fx")) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const fx = document.createElement("div");
    fx.className = "bg-fx";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML =
        '<div class="layer"><i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i></div>' +
        '<canvas class="net"></canvas>' +
        '<div class="spot"></div>';
    document.body.prepend(fx);

    /* slow parallax of the glows while scrolling */
    let scrollTick = false;
    function updateScroll() {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        fx.style.setProperty("--p", (h > 0 ? window.scrollY / h : 0).toFixed(4));
        scrollTick = false;
    }
    window.addEventListener("scroll", function () {
        if (!scrollTick) { scrollTick = true; requestAnimationFrame(updateScroll); }
    }, { passive: true });
    updateScroll();

    /* star network */
    const cv = fx.querySelector(".net");
    const ctx = cv.getContext("2d");
    const mouse = { x: -9999, y: -9999 };
    let W = 0, H = 0, pts = [];

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        cv.width = W * dpr;
        cv.height = H * dpr;
        cv.style.width = W + "px";
        cv.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const n = Math.min(110, Math.max(35, Math.floor((W * H) / 17000)));
        pts = [];
        for (let i = 0; i < n; i++) {
            pts.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3
            });
        }
    }

    function step() {
        ctx.clearRect(0, 0, W, H);
        const LINK = 130, REACH = 160;

        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            if (!reduce) {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > W) p.vx *= -1;
                if (p.y < 0 || p.y > H) p.vy *= -1;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(167,139,250,.55)";
            ctx.fill();

            for (let j = i + 1; j < pts.length; j++) {
                const q = pts[j];
                const dx = p.x - q.x, dy = p.y - q.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < LINK * LINK) {
                    const a = 0.16 * (1 - Math.sqrt(d2) / LINK);
                    ctx.strokeStyle = "rgba(139,92,246," + a + ")";
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(q.x, q.y);
                    ctx.stroke();
                }
            }

            const mx = p.x - mouse.x, my = p.y - mouse.y;
            const m2 = mx * mx + my * my;
            if (m2 < REACH * REACH) {
                const a = 0.35 * (1 - Math.sqrt(m2) / REACH);
                ctx.strokeStyle = "rgba(34,211,238," + a + ")";
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.stroke();
            }
        }
    }

    function loop() { step(); requestAnimationFrame(loop); }

    resize();
    window.addEventListener("resize", resize);
    if (reduce) { step(); } else { loop(); }

    /* cursor: soft spotlight and links to nearby stars */
    let moveTick = false, cx = 0, cy = 0;
    window.addEventListener("mousemove", function (e) {
        mouse.x = e.clientX; mouse.y = e.clientY;
        cx = e.clientX; cy = e.clientY;
        if (!moveTick) {
            moveTick = true;
            requestAnimationFrame(function () {
                fx.style.setProperty("--cx", cx + "px");
                fx.style.setProperty("--cy", cy + "px");
                moveTick = false;
            });
        }
    }, { passive: true });
    document.addEventListener("mouseleave", function () { mouse.x = mouse.y = -9999; });
})();