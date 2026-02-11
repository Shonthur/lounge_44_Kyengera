(() => {
  const EMBED_SRC =
    "https://cdn.jotfor.ms/agent/embedjs/019c4b50308d729fae82faf07888414ecce8/embed.js";

  function hasEmbedScript() {
    return Array.from(document.getElementsByTagName("script")).some((s) => s?.src === EMBED_SRC);
  }

  function load() {
    if (hasEmbedScript()) return;
    const script = document.createElement("script");
    script.src = EMBED_SRC;
    script.async = true;
    document.head.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();

