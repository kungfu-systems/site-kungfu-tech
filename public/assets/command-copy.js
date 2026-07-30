async function writeCommandToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy command was not accepted");
}

document.querySelectorAll("[data-copy-command]").forEach((button) => {
  button.addEventListener("click", async () => {
    const command = button.closest(".command-block")?.querySelector("code")?.textContent?.trim();
    if (!command) return;

    const defaultLabel = button.getAttribute("aria-label") || "Copy command";
    try {
      await writeCommandToClipboard(command);
      button.textContent = "Copied";
      button.setAttribute("aria-label", "Command copied");
      button.dataset.copyState = "copied";
    } catch {
      button.textContent = "Copy failed";
      button.setAttribute("aria-label", "Copy failed");
      button.dataset.copyState = "failed";
    }

    window.setTimeout(() => {
      button.textContent = "Copy";
      button.setAttribute("aria-label", defaultLabel);
      delete button.dataset.copyState;
    }, 1800);
  });
});
