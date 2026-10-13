(function () {

    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const MAGIC = "RAGX1";
    const ITERATIONS = 600000;

    const $ = (id) => document.getElementById(id);
    const toast = (msg, type) =>
        typeof showToast === "function" ? showToast(msg, type) : alert(msg);

    /* ---------- crypto helpers ---------- */

    function concat() {
        let total = 0;
        for (const p of arguments) total += p.length;
        const out = new Uint8Array(total);
        let offset = 0;
        for (const p of arguments) { out.set(p, offset); offset += p.length; }
        return out;
    }

    async function deriveKey(password, salt, iterations) {
        const base = await crypto.subtle.importKey(
            "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
        );
        return crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
            base,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    async function encryptPayload(meta, dataBytes, password) {
        const metaBytes = enc.encode(JSON.stringify(meta));
        const lenBytes = new Uint8Array(4);
        new DataView(lenBytes.buffer).setUint32(0, metaBytes.length);
        const plain = concat(lenBytes, metaBytes, dataBytes);

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const iterBytes = new Uint8Array(4);
        new DataView(iterBytes.buffer).setUint32(0, ITERATIONS);

        const header = concat(enc.encode(MAGIC), iterBytes, salt); // 25 bytes
        const key = await deriveKey(password, salt, ITERATIONS);

        const cipher = new Uint8Array(await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv, additionalData: header }, key, plain
        ));
        return concat(header, iv, cipher);
    }

    async function decryptPayload(bytes, password) {
        if (bytes.length < 25 + 12 + 16) throw new Error("format");
        if (dec.decode(bytes.slice(0, 5)) !== MAGIC) throw new Error("format");

        const iterations = new DataView(bytes.buffer, bytes.byteOffset + 5, 4).getUint32(0);
        if (iterations < 1000 || iterations > 5000000) throw new Error("format");

        const header = bytes.slice(0, 25);
        const salt = bytes.slice(9, 25);
        const iv = bytes.slice(25, 37);
        const cipher = bytes.slice(37);

        const key = await deriveKey(password, salt, iterations);
        const plain = new Uint8Array(await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv, additionalData: header }, key, cipher
        ));

        const metaLen = new DataView(plain.buffer, plain.byteOffset, 4).getUint32(0);
        const meta = JSON.parse(dec.decode(plain.slice(4, 4 + metaLen)));
        const data = plain.slice(4 + metaLen);
        return { meta: meta, data: data };
    }

    function download(bytes, name) {
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function withBusy(fn) {
        document.body.classList.add("busy");
        await new Promise(r => setTimeout(r, 30));
        try { await fn(); } finally { document.body.classList.remove("busy"); }
    }

    /* ---------- tab switching ---------- */

    const vaultBtn = $("showVaultSection");
    const vaultSec = $("vaultSection");
    const otherIds = ["showMessageSection", "showFileSection", "showFileLockSection"];
    const otherSecIds = ["messageSection", "fileSection", "fileLockSection"];

    vaultBtn.addEventListener("click", function () {
        otherSecIds.forEach(id => { $(id).style.display = "none"; });
        otherIds.forEach(id => $(id).classList.remove("active-tab"));
        vaultSec.style.display = "block";
        vaultBtn.classList.add("active-tab");
    });

    otherIds.forEach(id => {
        $(id).addEventListener("click", function () {
            vaultSec.style.display = "none";
            vaultBtn.classList.remove("active-tab");
        });
    });

    $("showVaultEncrypt").addEventListener("click", function () {
        $("vaultEncryptSection").style.display = "block";
        $("vaultDecryptSection").style.display = "none";
        this.classList.add("active-tab");
        $("showVaultDecrypt").classList.remove("active-tab");
    });

    $("showVaultDecrypt").addEventListener("click", function () {
        $("vaultEncryptSection").style.display = "none";
        $("vaultDecryptSection").style.display = "block";
        this.classList.add("active-tab");
        $("showVaultEncrypt").classList.remove("active-tab");
    });

    /* ---------- file name display ---------- */

    $("vaultFileInput").addEventListener("change", function () {
        $("vaultFileName").textContent = this.files.length ? this.files[0].name : "";
    });

    $("vaultDecFileInput").addEventListener("change", function () {
        $("vaultDecFileName").textContent = this.files.length ? this.files[0].name : "";
    });

    /* ---------- encrypt ---------- */

    $("vaultEncryptBtn").addEventListener("click", async function () {
        const file = $("vaultFileInput").files[0];
        const text = $("vaultText").value;
        const pw = $("vaultPassword").value;
        const pw2 = $("vaultPassword2").value;

        if (!file && !text) return toast("Enter a message or choose a file.", "error");
        if (pw.length < 8) return toast("Use a password of at least 8 characters.", "error");
        if (pw !== pw2) return toast("Passwords do not match.", "error");

        await withBusy(async function () {
            try {
                let meta, data, outName;
                if (file) {
                    meta = { type: "file", name: file.name };
                    data = new Uint8Array(await file.arrayBuffer());
                    outName = file.name + ".ragx";
                } else {
                    meta = { type: "text" };
                    data = enc.encode(text);
                    outName = "message.ragx";
                }

                const packed = await encryptPayload(meta, data, pw);
                download(packed, outName);
                toast("Encrypted! Keep your password safe. It cannot be recovered.", "success");
            } catch (e) {
                console.error(e);
                toast("Encryption failed.", "error");
            }
        });
    });

    /* ---------- decrypt ---------- */

    $("vaultDecryptBtn").addEventListener("click", async function () {
        const file = $("vaultDecFileInput").files[0];
        const pw = $("vaultDecPassword").value;

        if (!file) return toast("Choose a .ragx file.", "error");
        if (!pw) return toast("Enter the password.", "error");

        await withBusy(async function () {
            try {
                const bytes = new Uint8Array(await file.arrayBuffer());
                const result = await decryptPayload(bytes, pw);

                if (result.meta.type === "text") {
                    $("vaultResult").textContent = dec.decode(result.data);
                    $("vaultResultRow").style.display = "flex";
                    toast("Decrypted successfully!", "success");
                } else {
                    $("vaultResultRow").style.display = "none";
                    const safeName = String(result.meta.name || "decrypted_file").replace(/[\\\/]/g, "_");
                    download(result.data, safeName);
                    toast("File decrypted successfully!", "success");
                }
            } catch (e) {
                $("vaultResultRow").style.display = "none";
                toast("Wrong password or the file is damaged.", "error");
            }
        });
    });

})();