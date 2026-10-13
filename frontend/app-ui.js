(function () {
    var map = {
        text: "showMessageSection",
        file: "showFileSection",
        vault: "showVaultSection",
        pdf: "showFileLockSection",
        tools: "showToolsSection"
    };

    // runs after the other scripts have attached their click handlers
    document.addEventListener("DOMContentLoaded", function () {
        var key = (window.location.hash || "").replace("#", "");
        var btn = map[key] && document.getElementById(map[key]);
        if (btn) btn.click();
    });
})();