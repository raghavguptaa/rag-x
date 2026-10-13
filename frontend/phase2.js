(function () {

    /* Show / Hide password */
    document.querySelectorAll(".eye-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var input = document.getElementById(this.dataset.target);
            var hidden = input.type === "password";
            input.type = hidden ? "text" : "password";
            this.textContent = hidden ? "Hide" : "Show";
        });
    });

    /* Password strength meter */
    var lockPw = document.getElementById("lockPassword");
    var bar = document.getElementById("strengthBar");
    var label = document.getElementById("strengthText");

    function scorePassword(p) {
        var s = 0;
        if (p.length >= 8) s++;
        if (p.length >= 12) s++;
        if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
        if (/\d/.test(p)) s++;
        if (/[^A-Za-z0-9]/.test(p)) s++;
        return s;
    }

    if (lockPw && bar && label) {
        lockPw.addEventListener("input", function () {
            var p = this.value;
            if (!p) {
                bar.style.width = "0";
                label.textContent = "";
                return;
            }
            var s = scorePassword(p);
            var color = "#ef4444";
            var text = "Weak: add length, numbers and symbols";
            if (s >= 4) { color = "#8b5cf6"; text = "Strong password"; }
            else if (s >= 2) { color = "#f59e0b"; text = "Medium: could be stronger"; }
            bar.style.width = (s / 5) * 100 + "%";
            bar.style.background = color;
            label.textContent = text;
        });
    }

    /* Drag and drop for every upload box */
    document.querySelectorAll(".upload-wrapper").forEach(function (wrapper) {
        var input = wrapper.querySelector("input[type=file]");

        ["dragenter", "dragover"].forEach(function (ev) {
            wrapper.addEventListener(ev, function (e) {
                e.preventDefault();
                wrapper.classList.add("drag-over");
            });
        });

        ["dragleave", "drop"].forEach(function (ev) {
            wrapper.addEventListener(ev, function (e) {
                e.preventDefault();
                wrapper.classList.remove("drag-over");
            });
        });

        wrapper.addEventListener("drop", function (e) {
            if (e.dataTransfer.files.length && input) {
                input.files = e.dataTransfer.files;
                input.dispatchEvent(new Event("change"));
            }
        });
    });

    /* Loading bar for every server request */
    var originalFetch = window.fetch;
    window.fetch = function () {
        document.body.classList.add("busy");
        return originalFetch.apply(this, arguments).finally(function () {
            document.body.classList.remove("busy");
        });
    };

})();