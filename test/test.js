
var currentMode;

function postMessage(data) {
    document.getElementById("debug-target").contentWindow
        .postMessage(data, "*");
}

function loadsdkmenu() {
    if (currentMode) {
        alert("Reload first.");
        return;
    }

    postMessage({
        command: "init",
        content: JSON.stringify(sdkmenudata)
    });
    currentMode = "SDK";
}

function loadnuttxmenu() {
    if (currentMode) {
        alert("Reload first.");
        return;
    }

    postMessage({
        command: "init",
        content: JSON.stringify(nuttxmenudata)
    });
    currentMode = "Kernel";
}

window.addEventListener("message", function (event) {
    const message = event.data;

    console.log(message);

    switch (message.command) {
        case "get-defconfigs":
            postMessage({
                command: "get-defconfigs",
                content: currentMode === "SDK" ? defconfigList : kernelDefconfigList
            });
            break;

        case "load-defconfigs":
            let data = {
                command: "load-defconfigs"
            };

            switch (message.content) {
                case "examples/adc":
                    data.content = adcDefconfig;
                    break;
                case "examples/audio_player":
                    data.content = audio_playerDefconfig;
                    break;
                case "kernel/release":
                    data.content = releaseDefconfig;
                    break;
                default:
                    return;
            }
            postMessage(data);
            break;

        case "save":
            break;

        case "saveas":
            break;

        case "load":
            break;
    }
});
