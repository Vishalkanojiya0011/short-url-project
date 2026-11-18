const form = document.querySelector("#shorten-form");
const destinationInput = document.querySelector("#destination");
const customCodeInput = document.querySelector("#custom-code");
const submitButton = document.querySelector("#submit-button");
const formMessage = document.querySelector("#form-message");
const resultPanel = document.querySelector("#result-panel");
const resultLink = document.querySelector("#result-link");
const resultDestination = document.querySelector("#result-destination");
const copyResultButton = document.querySelector("#copy-result");
const linksList = document.querySelector("#links-list");
const emptyState = document.querySelector("#empty-state");
const linkCount = document.querySelector("#link-count");
const toast = document.querySelector("#toast");
const storageKey = "snip.recent-links";

let recentLinks = loadLinks();
let activeResultUrl = "";
let toastTimeout;
document.querySelector("#alias-prefix").textContent = `${window.location.host}/`;

function loadLinks() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter((item) => item && typeof item.code === "string" && typeof item.shortUrl === "string")
      : [];
  } catch {
    return [];
  }
}

function saveLinks() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(recentLinks));
  } catch {
    showToast("Your browser couldn’t save recent links.");
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function renderLinks() {
  linkCount.textContent = String(recentLinks.length);
  emptyState.hidden = recentLinks.length > 0;
  linksList.innerHTML = recentLinks.map((item) => `
    <article class="link-row" data-code="${escapeHtml(item.code)}">
      <div class="link-main">
        <a class="link-short" href="${escapeHtml(item.shortUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.shortUrl.replace(/^https?:\/\//, ""))}</a>
        <div class="link-destination" title="${escapeHtml(item.destination)}">${escapeHtml(item.destination)}</div>
      </div>
      <div class="link-stat"><b data-clicks="${escapeHtml(item.code)}">—</b><span>total clicks</span></div>
      <div class="link-stat"><b>${escapeHtml(formatDate(item.createdAt))}</b><span>created</span></div>
      <div class="row-actions">
        <button class="icon-button" type="button" data-action="copy" aria-label="Copy short link" title="Copy short link">
          <svg viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>
        </button>
        <button class="icon-button" type="button" data-action="remove" aria-label="Remove from this list" title="Remove from this list">
          <svg viewBox="0 0 20 20" fill="none"><path d="M3 5h14M8 5V3h4v2m3 0-.8 11H5.8L5 5m3 3v5m4-5v5" /></svg>
        </button>
      </div>
    </article>
  `).join("");
  refreshStats();
}

function formatDate(value) {
  if (!value) return "Today";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Today";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

async function refreshStats() {
  await Promise.all(recentLinks.map(async (item) => {
    const clicksCell = [...linksList.querySelectorAll("[data-clicks]")].find((cell) => cell.dataset.clicks === item.code);
    if (!clicksCell) return;
    try {
      const response = await fetch(`/api/urls/${encodeURIComponent(item.code)}/stats`);
      if (!response.ok) {
        clicksCell.textContent = response.status === 404 ? "—" : "!";
        return;
      }
      const stats = await response.json();
      clicksCell.textContent = String(stats.totalClicks);
    } catch {
      clicksCell.textContent = "—";
    }
  }));
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast("Short link copied to clipboard.");
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    showToast(copied ? "Short link copied to clipboard." : "Could not copy the link. Select and copy it instead.");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  resultPanel.hidden = true;

  const body = { url: destinationInput.value.trim() };
  if (customCodeInput.value.trim()) body.customCode = customCodeInput.value.trim();

  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Creating link…";
  try {
    const response = await fetch("/api/urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not shorten this URL.");

    activeResultUrl = data.shortUrl;
    resultLink.href = data.shortUrl;
    resultLink.textContent = data.shortUrl.replace(/^https?:\/\//, "");
    resultDestination.textContent = data.destination;
    resultPanel.hidden = false;
    recentLinks = [
      { code: data.code, shortUrl: data.shortUrl, destination: data.destination, createdAt: data.createdAt },
      ...recentLinks.filter((item) => item.code !== data.code),
    ].slice(0, 20);
    saveLinks();
    renderLinks();
    customCodeInput.value = "";
    showToast("Your short link is ready.");
  } catch (error) {
    formMessage.textContent = error instanceof TypeError
      ? "Could not connect to the API. Check that the server is running."
      : error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Shorten link";
  }
});

document.querySelector("#paste-button").addEventListener("click", async () => {
  try {
    destinationInput.value = await navigator.clipboard.readText();
    destinationInput.focus();
  } catch {
    showToast("Clipboard access isn’t available. Paste directly into the URL field.");
    destinationInput.focus();
  }
});

copyResultButton.addEventListener("click", () => copyText(activeResultUrl));
document.querySelector("#refresh-links").addEventListener("click", refreshStats);

linksList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const row = button.closest(".link-row");
  const code = row?.dataset.code;
  const link = recentLinks.find((item) => item.code === code);
  if (!link) return;

  if (button.dataset.action === "copy") {
    await copyText(link.shortUrl);
  } else {
    recentLinks = recentLinks.filter((item) => item.code !== code);
    saveLinks();
    renderLinks();
    showToast("Link removed from your recent list.");
  }
});

async function checkConnection() {
  const indicator = document.querySelector(".connection");
  const label = document.querySelector("#connection-text");
  try {
    const response = await fetch("/health");
    if (!response.ok) throw new Error("API unavailable");
    indicator.classList.add("is-online");
    indicator.classList.remove("is-offline");
    label.textContent = "All systems up";
  } catch {
    indicator.classList.add("is-offline");
    indicator.classList.remove("is-online");
    label.textContent = "API offline";
  }
}

renderLinks();
checkConnection();
