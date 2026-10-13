function showToast(message, type = "info") {
    let box = document.getElementById("toastBox");
    if (!box) {
        box = document.createElement("div");
        box.id = "toastBox";
        document.body.appendChild(box);
    }

    const toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.textContent = message;
    box.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("hide");
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// Every existing alert() in your code now shows a toast instead
window.alert = function (msg) {
    const text = String(msg);
    const good = /success|copied/i.test(text);
    const bad = /invalid|fail|wrong|error|empty|only pdf/i.test(text);
    showToast(text, good ? "success" : bad ? "error" : "info");
};




document.addEventListener("DOMContentLoaded", function () {

    /* ================= GLOBAL VARIABLES ================= */

    let encryptedFileBlob = null;
    let encryptedFileName = "";
    let lastFileKey = "";
    let lastFileIv = "";

    /* ================= MAIN SECTION SWITCH ================= */

function showSection(sectionId, activeBtn) {

    const sections = ["messageSection", "fileSection", "fileLockSection"];
    const buttons = ["showMessageSection", "showFileSection", "showFileLockSection"];

    // Hide all sections
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = "none";
    });

    // Remove active class from all buttons
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove("active-tab");
    });

    // Show selected section
    document.getElementById(sectionId).style.display = "block";

    // Activate clicked button
    activeBtn.classList.add("active-tab");
}

document.getElementById("showMessageSection")
    .addEventListener("click", function () {
        showSection("messageSection", this);
    });

document.getElementById("showFileSection")
    .addEventListener("click", function () {
        showSection("fileSection", this);
    });

document.getElementById("showFileLockSection")
    .addEventListener("click", function () {
        showSection("fileLockSection", this);
    });


    /* ================= MESSAGE TAB SWITCH ================= */

    document.getElementById("showEncrypt").addEventListener("click", function () {
        document.getElementById("encryptionSection").style.display = "block";
        document.getElementById("decryptionSection").style.display = "none";
        this.classList.add("active-tab");
        document.getElementById("showDecrypt").classList.remove("active-tab");
    });

    document.getElementById("showDecrypt").addEventListener("click", function () {
        document.getElementById("encryptionSection").style.display = "none";
        document.getElementById("decryptionSection").style.display = "block";
        this.classList.add("active-tab");
        document.getElementById("showEncrypt").classList.remove("active-tab");
    });

    /* ================= FILE TAB SWITCH ================= */

    document.getElementById("showFileEncrypt").addEventListener("click", function () {
        document.getElementById("fileEncryptSection").style.display = "block";
        document.getElementById("fileDecryptSection").style.display = "none";
        this.classList.add("active-tab");
        document.getElementById("showFileDecrypt").classList.remove("active-tab");
    });

    document.getElementById("showFileDecrypt").addEventListener("click", function () {
        document.getElementById("fileEncryptSection").style.display = "none";
        document.getElementById("fileDecryptSection").style.display = "block";
        this.classList.add("active-tab");
        document.getElementById("showFileEncrypt").classList.remove("active-tab");
    });

    /*flie lock*/


    document.getElementById("showLock").addEventListener("click", function () {
    document.getElementById("lockSection").style.display = "block";
    document.getElementById("unlockSection").style.display = "none";
    this.classList.add("active-tab");
    document.getElementById("showUnlock").classList.remove("active-tab");
    });

    document.getElementById("showUnlock").addEventListener("click", function () {
    document.getElementById("lockSection").style.display = "none";
    document.getElementById("unlockSection").style.display = "block";
    this.classList.add("active-tab");
    document.getElementById("showLock").classList.remove("active-tab");
    });



    /* ================= MESSAGE ENCRYPT ================= */

    document.getElementById("encryptBtn").addEventListener("click", async function () {

        const message = document.getElementById("messageInput").value;
        if (!message) return alert("Enter a message.");

        const encoder = new TextEncoder();
        const data = encoder.encode(message);

        const key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            data
        );

        const exportedKey = await crypto.subtle.exportKey("raw", key);

        const toBase64 = (buffer) =>
            btoa(String.fromCharCode(...new Uint8Array(buffer)));

        document.getElementById("encryptedText").innerText = toBase64(encrypted);
        document.getElementById("generatedKey").innerText = toBase64(exportedKey);
        document.getElementById("ivValue").innerText = toBase64(iv);
    });

    /* ================= MESSAGE DECRYPT ================= */

    document.getElementById("decryptBtn").addEventListener("click", async function () {

        const encryptedText = document.getElementById("decryptEncryptedInput").value.trim();
        const keyText = document.getElementById("decryptKeyInput").value.trim();
        const ivText = document.getElementById("decryptIVInput").value.trim();

        if (!encryptedText || !keyText || !ivText)
            return alert("Fill all fields.");

        const fromBase64 = (base64) =>
            Uint8Array.from(atob(base64), c => c.charCodeAt(0));

        try {
            const key = await crypto.subtle.importKey(
                "raw",
                fromBase64(keyText),
                { name: "AES-GCM" },
                false,
                ["decrypt"]
            );

            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: fromBase64(ivText) },
                key,
                fromBase64(encryptedText)
            );

            const decoder = new TextDecoder();
            document.getElementById("decryptedText").innerText =
                decoder.decode(decrypted);

        } catch {
            alert("Invalid key or IV.");
        }
    });

    /* ================= COPY BUTTONS ================= */

    document.querySelectorAll(".copy-btn").forEach(button => {
        button.addEventListener("click", function () {

            const targetId = this.getAttribute("data-copy");
            const text = document.getElementById(targetId).innerText;

            if (!text) return alert("Nothing to copy.");

            navigator.clipboard.writeText(text).then(() => {
                this.innerText = "Copied!";
                setTimeout(() => this.innerText = "Copy", 1200);
            });
        });
    });

    /* ================= DOWNLOAD MESSAGE JSON ================= */

    document.getElementById("downloadAllBtn").addEventListener("click", function () {

        const encrypted = document.getElementById("encryptedText").innerText.trim();
        const key = document.getElementById("generatedKey").innerText.trim();
        const iv = document.getElementById("ivValue").innerText.trim();

        if (!encrypted || !key || !iv)
            return alert("Encrypt a message first.");

        const data = {
            cipher_name: "Rag X",
            algorithm: "AES-256-GCM",
            encrypted_message: encrypted,
            aes_key: key,
            iv: iv,
            timestamp: new Date().toISOString()
        };

        const blob = new Blob(
            [JSON.stringify(data, null, 4)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ragx_package.json";
        a.click();
        URL.revokeObjectURL(url);
    });

    /* ================= UPLOAD MESSAGE JSON ================= */

    document.getElementById("uploadJsonFile").addEventListener("change", function (event) {

        const file = event.target.files[0];
        if (!file) return;

        document.getElementById("fileNameDisplay").innerText = file.name;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const jsonData = JSON.parse(e.target.result);

                document.getElementById("decryptEncryptedInput").value =
                    jsonData.encrypted_message;
                document.getElementById("decryptKeyInput").value =
                    jsonData.aes_key;
                document.getElementById("decryptIVInput").value =
                    jsonData.iv;

                alert("File loaded successfully!");
            } catch {
                alert("Invalid JSON file.");
            }
        };

        reader.readAsText(file);
    });

/* ================= FILE ENCRYPT ================= */

document.getElementById("encryptFileBtn").addEventListener("click", async function () {

    const fileInput = document.getElementById("fileInput");

    if (!fileInput.files.length)
        return alert("Select a file.");

    const file = fileInput.files[0];

    // 🔥 EMPTY FILE CHECK
    if (file.size === 0) {
        alert("Empty file detected. Please upload a valid file.");
        fileInput.value = "";
        document.getElementById("fileNameDisplayEncrypt").innerText = "";
        return;
    }

    const buffer = await file.arrayBuffer();

    const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        buffer
    );

    const exportedKey = await crypto.subtle.exportKey("raw", key);

    const toBase64 = (buffer) =>
        btoa(String.fromCharCode(...new Uint8Array(buffer)));

    lastFileKey = toBase64(exportedKey);
    lastFileIv = toBase64(iv);

    document.getElementById("fileKeyOutput").innerText = lastFileKey;
    document.getElementById("fileIvOutput").innerText = lastFileIv;

    const originalExtension = file.name.split('.').pop();

    encryptedFileBlob = new Blob([encrypted]);

    // Save extension inside filename
    encryptedFileName = file.name + ".encrypted";

    // 🔥 Save extension globally
    window.originalFileExtension = originalExtension;
    window.originalFileName = file.name;

    document.getElementById("downloadEncryptedFileBtn").style.display = "inline-block";
    document.getElementById("downloadKeyIvFileBtn").style.display = "inline-block";
});


/* ================= FILE NAME DISPLAY (ENCRYPT) ================= */

document.getElementById("fileInput").addEventListener("change", function () {

    const file = this.files[0];
    if (!file) return;

    if (file.size === 0) {
        alert("Empty file detected. Please upload a valid file.");
        this.value = "";
        document.getElementById("fileNameDisplayEncrypt").innerText = "";
        return;
    }

    document.getElementById("fileNameDisplayEncrypt").innerText = file.name;
});


/* ================= FILE NAME DISPLAY (DECRYPT) ================= */

document.getElementById("encryptedFileInput").addEventListener("change", function () {

    const file = this.files[0];
    if (!file) return;

    if (file.size === 0) {
        alert("Empty encrypted file. Please upload a valid file.");
        this.value = "";
        document.getElementById("fileNameDisplayDecrypt").innerText = "";
        return;
    }

    document.getElementById("fileNameDisplayDecrypt").innerText = file.name;
});


/* ================= DOWNLOAD ENCRYPTED FILE ================= */

document.getElementById("downloadEncryptedFileBtn").addEventListener("click", function () {

    if (!encryptedFileBlob)
        return alert("No encrypted file available.");

    const url = URL.createObjectURL(encryptedFileBlob);
    const a = document.createElement("a");

    a.href = url;
    a.download = encryptedFileName;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
});


/* ================= DOWNLOAD KEY FILE ================= */

document.getElementById("downloadKeyIvFileBtn").addEventListener("click", function () {

    if (!lastFileKey || !lastFileIv)
        return alert("No key available.");

    const data = {
        cipher_name: "Rag X",
        algorithm: "AES-256-GCM",
        aes_key: lastFileKey,
        iv: lastFileIv,
        file_extension: window.originalFileExtension,
        original_filename: window.originalFileName,
        timestamp: new Date().toISOString()
    };

    const blob = new Blob(
        [JSON.stringify(data, null, 4)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "file_key_package.json";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
});


/* ================= FILE DECRYPT ================= */

document.getElementById("decryptFileBtn").addEventListener("click", async function () {

    const fileInput = document.getElementById("encryptedFileInput");
    const keyText = document.getElementById("fileDecryptKey").value.trim();
    const ivText = document.getElementById("fileDecryptIv").value.trim();

    if (!fileInput.files.length)
        return alert("Upload encrypted file.");

    if (!keyText || !ivText)
        return alert("Provide key and IV.");

    const file = fileInput.files[0];

    if (file.size === 0) {
        alert("Encrypted file is empty.");
        return;
    }

    const fromBase64 = (base64) =>
        Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    try {

        const encryptedBuffer = await file.arrayBuffer();

        const key = await crypto.subtle.importKey(
            "raw",
            fromBase64(keyText),
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: fromBase64(ivText) },
            key,
            encryptedBuffer
        );

        const blob = new Blob([decrypted]);
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        if (window.originalFileName) {
        a.download = window.originalFileName;
        } else {
        const ext = window.originalFileExtension || "bin";
        a.download = "decrypted_file." + ext;
        }
        a.click();

        URL.revokeObjectURL(url);

    } catch {
        alert("Decryption failed. Invalid key or IV.");
    }
});


/* ================= AUTO-FILL KEY FILE ================= */

document.getElementById("keyFileInput").addEventListener("change", function () {


    const file = this.files[0];
    if (!file) return;

    if (file.size === 0) {
        alert("Empty key file.");
        this.value = "";
        document.getElementById("keyFileNameDisplay").innerText = "";
        return;
    }

    document.getElementById("keyFileNameDisplay").innerText = file.name;

    const reader = new FileReader();

    reader.onload = function (event) {
    try {
        const data = JSON.parse(event.target.result);

        // Flexible validation
        if (!data.aes_key || !data.iv) {
            alert("Invalid key file format.");
            return;
        }

        // Fill inputs
        document.getElementById("fileDecryptKey").value = data.aes_key;
        document.getElementById("fileDecryptIv").value = data.iv;

        // 🔥 Handle extension safely
        if (data.file_extension) {
            window.originalFileExtension = data.file_extension;
        }

        if (data.original_filename) {
        window.originalFileName = data.original_filename;
        }

        alert("Key file loaded successfully!");

    } catch (error) {
        console.error(error);
        alert("Invalid JSON file.");
    }
    };

    reader.readAsText(file);
});


/* ================= FILE LOCK (PASSWORD BASED) ================= */

document.getElementById("lockFileBtn").addEventListener("click", async function () {

    const fileInput = document.getElementById("lockFileInput");
    const password = document.getElementById("lockPassword").value;

    if (!fileInput.files.length)
        return alert("Select a file.");

    if (!password)
        return alert("Enter password.");

    const file = fileInput.files[0];
    if (file.type !== "application/pdf") {
        alert("Only PDF files are allowed.");
        return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    try {
        const response = await fetch("/lock-file", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            alert("Lock failed.");
            return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;

        // Let backend control filename
        const disposition = response.headers.get("Content-Disposition");
        let filename = "locked_file";

        if (disposition && disposition.includes("filename=")) {
            filename = disposition.split("filename=")[1].replace(/"/g, "");
        }

        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);

    } catch {
        alert("Server error.");
    }
});



document.getElementById("unlockFileBtn").addEventListener("click", async function () {

    const fileInput = document.getElementById("unlockFileInput");
    const password = document.getElementById("unlockPassword").value;

    if (!fileInput.files.length)
        return alert("Select locked file.");

    if (!password)
        return alert("Enter password.");

    const file = fileInput.files[0];
    if (file.type !== "application/pdf") {
        alert("Only PDF files are allowed.");
        return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    try {
        const response = await fetch("/unlock-file", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            alert("Wrong password or unsupported file.");
            return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const disposition = response.headers.get("Content-Disposition");
        let filename = "unlocked_file";

        if (disposition && disposition.includes("filename=")) {
            filename = disposition.split("filename=")[1].replace(/"/g, "");
        }

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);

    } catch {
        alert("Server error.");
    }
});


/* File name display */
document.getElementById("lockFileInput").addEventListener("change", function () {
    document.getElementById("lockFileName").innerText =
        this.files.length ? this.files[0].name : "No file selected";
});

document.getElementById("unlockFileInput").addEventListener("change", function () {
    document.getElementById("unlockFileName").innerText =
        this.files.length ? this.files[0].name : "No file selected";
});

/* Show/Hide Password */
function togglePassword(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);

    button.addEventListener("click", () => {
        input.type = input.type === "password" ? "text" : "password";
    });
}

});

