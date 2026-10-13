(function () {
    "use strict";

    // the real fetch, used for logging so it never triggers the page's loading bar
    var native = window.fetch.bind(window);
    var signedIn = false;
    var csrf = null;

    function paused() {
        try { return localStorage.getItem("ragx_pause_tracking") === "1"; } catch (e) { return false; }
    }

    // only signed-in visitors are tracked
    native("/api/me", { credentials: "same-origin" })
        .then(function (r) { signedIn = r.ok; })
        .catch(function () {});

    function getToken(force) {
        if (csrf && !force) return Promise.resolve(csrf);
        return native("/api/csrf", { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (d) { csrf = d.token; return csrf; });
    }

    function send(tool, action, size, retried) {
        getToken(retried)
            .then(function (token) {
                return native("/api/activity", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
                    body: JSON.stringify({ tool: tool, action: action, size: size })
                });
            })
            .then(function (r) {
                if (r.status === 403 && !retried) send(tool, action, size, true);
            })
            .catch(function () {});
    }

    // metadata only: which tool, which action, how big. Never any content.
    function track(tool, action, size) {
        if (!signedIn || paused()) return;
        send(tool, action, Math.max(0, Math.round(size || 0)), false);
    }

    var SECTIONS = [
        ["messageSection", "text"],
        ["fileSection", "file"],
        ["vaultSection", "vault"],
        ["toolsSection", "hash"],
        ["fileLockSection", "pdf"]
    ];

    function activeTool() {
        for (var i = 0; i < SECTIONS.length; i++) {
            var el = document.getElementById(SECTIONS[i][0]);
            if (el && el.style.display !== "none") return SECTIONS[i][1];
        }
        return null;
    }

    function sizeOf(x) {
        return x && typeof x.byteLength === "number" ? x.byteLength : 0;
    }

    function cipherTool(tool) {
        return tool === "text" || tool === "file" || tool === "vault";
    }

    /* every cipher tool goes through the Web Crypto API, so one wrapper covers them all */
    if (window.SubtleCrypto && SubtleCrypto.prototype) {
        var P = SubtleCrypto.prototype;
        var oEncrypt = P.encrypt, oDecrypt = P.decrypt, oDigest = P.digest;

        P.encrypt = function (alg, key, data) {
            var tool = activeTool();
            return oEncrypt.apply(this, arguments).then(function (res) {
                if (cipherTool(tool)) track(tool, "encrypt", sizeOf(data));
                return res;
            });
        };

        P.decrypt = function () {
            var tool = activeTool();
            return oDecrypt.apply(this, arguments).then(function (res) {
                if (cipherTool(tool)) track(tool, "decrypt", sizeOf(res));
                return res;
            });
        };

        P.digest = function (alg, data) {
            return oDigest.apply(this, arguments).then(function (res) {
                track("hash", "hash", sizeOf(data));
                return res;
            });
        };
    }

    /* PDF lock and unlock go to the server, so watch those requests */
    var chained = window.fetch;
    window.fetch = function (input, init) {
        var url = typeof input === "string" ? input : ((input && input.url) || "");
        var promise = chained.apply(this, arguments);
        var m = /\/(lock|unlock)-file$/.exec(url.split("?")[0]);
        if (m) {
            promise.then(function (res) {
                if (!res.ok) return;
                var size = 0;
                try {
                    var f = init && init.body && init.body.get("file");
                    size = f ? f.size : 0;
                } catch (e) {}
                track("pdf", m[1], size);
            }).catch(function () {});
        }
        return promise;
    };

    /* password generator: counted when the button is pressed, with no size */
    var gen = document.getElementById("genBtn");
    if (gen) {
        gen.addEventListener("click", function () { track("password", "generate", 0); });
    }
})();