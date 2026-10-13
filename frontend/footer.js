(function () {
    var f = document.getElementById("footer");
    if (!f) return;

    f.innerHTML =
        '<div class="container ft">' +
            '<div class="ft-left">' +
                '<div class="ft-brand">' +
                    '<a href="/" class="ft-name">Rag X</a>' +
                    '<span class="ft-tag">| Encryption Toolkit</span>' +
                '</div>' +
                '<p class="ft-desc">Encrypt text, files and PDFs in your browser.</p>' +
            '</div>' +
            '<nav class="ft-links">' +
                '<a href="/app.html">Toolkit</a>' +
                '<a href="/about.html">About</a>' +
                '<a href="/contact.html">Contact</a>' +
            '</nav>' +
        '</div>';
})();