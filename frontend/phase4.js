(function () {

    const $ = (id) => document.getElementById(id);
    const toast = (msg, type) =>
        typeof showToast === "function" ? showToast(msg, type) : alert(msg);

    /* ---------- main tab switching ---------- */

    const toolsBtn = $("showToolsSection");
    const toolsSec = $("toolsSection");
    const mainBtnIds = ["showMessageSection", "showFileSection", "showFileLockSection", "showVaultSection"];
    const mainSecIds = ["messageSection", "fileSection", "fileLockSection", "vaultSection"];

    toolsBtn.addEventListener("click", function () {
        mainSecIds.forEach(id => { $(id).style.display = "none"; });
        mainBtnIds.forEach(id => $(id).classList.remove("active-tab"));
        toolsSec.style.display = "block";
        toolsBtn.classList.add("active-tab");
    });

    mainBtnIds.forEach(id => {
        $(id).addEventListener("click", function () {
            toolsSec.style.display = "none";
            toolsBtn.classList.remove("active-tab");
        });
    });

    /* ---------- sub tabs ---------- */

    $("showToolPw").addEventListener("click", function () {
        $("toolPwSection").style.display = "block";
        $("toolHashSection").style.display = "none";
        this.classList.add("active-tab");
        $("showToolHash").classList.remove("active-tab");
    });

    $("showToolHash").addEventListener("click", function () {
        $("toolPwSection").style.display = "none";
        $("toolHashSection").style.display = "block";
        this.classList.add("active-tab");
        $("showToolPw").classList.remove("active-tab");
    });

    /* ================= PASSWORD GENERATOR ================= */

    const SETS = {
        upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        lower: "abcdefghijklmnopqrstuvwxyz",
        numbers: "0123456789",
        symbols: "!@#$%^&*()-_=+[]{};:,.?"
    };

    // Secure random number without modulo bias
    function randomInt(max) {
        const limit = Math.floor(4294967296 / max) * max;
        const buf = new Uint32Array(1);
        do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
        return buf[0] % max;
    }

    function generatePassword() {
        const length = parseInt($("genLength").value, 10);
        const chosen = [];
        if ($("genUpper").checked) chosen.push(SETS.upper);
        if ($("genLower").checked) chosen.push(SETS.lower);
        if ($("genNumbers").checked) chosen.push(SETS.numbers);
        if ($("genSymbols").checked) chosen.push(SETS.symbols);

        if (!chosen.length) {
            toast("Select at least one character type.", "error");
            return;
        }

        const all = chosen.join("");

        // one guaranteed character from each chosen type
        const chars = chosen.map(set => set[randomInt(set.length)]);
        while (chars.length < length) chars.push(all[randomInt(all.length)]);

        // secure shuffle
        for (let i = chars.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            const tmp = chars[i];
            chars[i] = chars[j];
            chars[j] = tmp;
        }

        $("genOutput").textContent = chars.join("");

        const bits = Math.round(length * Math.log2(all.length));
        let color = "#ef4444", word = "Weak";
        if (bits >= 100) { color = "#8b5cf6"; word = "Excellent"; }
        else if (bits >= 75) { color = "#8b5cf6"; word = "Strong"; }
        else if (bits >= 50) { color = "#f59e0b"; word = "Fair"; }

        $("genBar").style.width = Math.min(100, (bits / 110) * 100) + "%";
        $("genBar").style.background = color;
        $("genText").textContent = word + " (about " + bits + " bits of entropy)";
    }

    $("genBtn").addEventListener("click", generatePassword);

    $("genLength").addEventListener("input", function () {
        $("genLengthVal").textContent = this.value;
        generatePassword();
    });

    ["genUpper", "genLower", "genNumbers", "genSymbols"].forEach(id => {
        $(id).addEventListener("change", generatePassword);
    });

    generatePassword();

    /* ================= HASH CHECKER ================= */

    function toHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }

    function checkMatch() {
        const out = $("hashOutput").textContent.trim().toLowerCase();
        const expected = $("hashCompare").value.trim().toLowerCase().replace(/\s+/g, "");
        const el = $("hashMatch");

        if (!expected || !out) { el.textContent = ""; return; }

        if (out === expected) {
            el.textContent = "✔ Match: the hashes are identical";
            el.style.color = "#8b5cf6";
        } else {
            el.textContent = "✘ No match: the content is different";
            el.style.color = "#ef4444";
        }
    }

    // file and text are alternatives: choosing one clears the other
    $("hashFileInput").addEventListener("change", function () {
        $("hashFileName").textContent = this.files.length ? this.files[0].name : "";
        if (this.files.length) $("hashText").value = "";
    });

    $("hashText").addEventListener("input", function () {
        if (this.value) {
            $("hashFileInput").value = "";
            $("hashFileName").textContent = "";
        }
    });

    $("hashCompare").addEventListener("input", checkMatch);

    $("hashBtn").addEventListener("click", async function () {
        const file = $("hashFileInput").files[0];
        const text = $("hashText").value;
        const algo = $("hashAlgo").value;

        if (!file && !text) return toast("Enter text or choose a file.", "error");
        if (file && file.size > 200 * 1024 * 1024)
            return toast("File is too large (max 200 MB).", "error");

        document.body.classList.add("busy");
        await new Promise(r => setTimeout(r, 30));

        try {
            const data = file ? await file.arrayBuffer() : new TextEncoder().encode(text);
            const digest = await crypto.subtle.digest(algo, data);
            $("hashOutput").textContent = toHex(digest);
            checkMatch();
            toast("Hash generated.", "success");
        } catch (e) {
            console.error(e);
            toast("Could not generate the hash.", "error");
        } finally {
            document.body.classList.remove("busy");
        }
    });

})();