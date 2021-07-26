function acquireVsCodeApi() {
  return {
    postMessage : function (obj) {
      window.parent.postMessage(obj, "*");
    }
  };
}
