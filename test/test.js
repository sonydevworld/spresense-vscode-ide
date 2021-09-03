
function postMessage(data) {
  document.getElementById("debug-target").contentWindow
    .postMessage(data, "*");
}

function loadMenu(content) {
  postMessage({
    command: "init",
    content: JSON.stringify(content),
  });
}

function sendDefconfigList(content) {
  postMessage({
    command: "get-defconfigs",
    content: content
  });
}

function loadDefconfigs(content) {
  postMessage({
    command: "load-defconfigs",
    content: content
  });
}

var messageContent;

window.addEventListener("message", function (event) {
  // Set window title as command, and save content internal variable.
  // The actual code is in selenium app.

  const message = event.data;
  document.title = message.command;
  messageContent = message.content;
});
