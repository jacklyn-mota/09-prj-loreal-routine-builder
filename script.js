/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const searchInput = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearAllButton = document.getElementById("clearSelectedProducts");
const toastContainer = document.querySelector(".toast-container");
const modalOverlay = document.querySelector(".modal-overlay");
const modalContent = modalOverlay.querySelector(".modal-content");
const modalCloseButton = modalOverlay.querySelector(".modal-close");

const generateRoutineButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const searchSection = document.querySelector(".search-section");

/* Keep the app state in one place so the UI stays in sync */
const STORAGE_KEY = "smartRoutineSelectedProducts";
const API_BASE_URL = "https://loeral-worker-2.motajacklyn00.workers.dev";

let allProducts = [];
let selectedProducts = [];
let messages = [];
let currentFilters = {
  category: "",
  search: "",
};
let loadingState = {
  active: false,
  text: "",
};
let removalTimeoutId = null;
let toastTimeoutId = null;

/* Show the first empty state before the user starts filtering */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Search or choose a category to view products.
  </div>
`;

/* Load product data from the JSON file once when the app starts */
async function loadProducts() {
  const response = await fetch("products.json");

  if (!response.ok) {
    throw new Error("Unable to load product data.");
  }

  const data = await response.json();
  return Array.isArray(data.products) ? data.products : [];
}

/* Escape user-facing text before inserting it into HTML */
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* Normalize text so filtering is case-insensitive */
function normalizeText(text) {
  return String(text || "")
    .trim()
    .toLowerCase();
}

/* Read the saved selection IDs from localStorage */
function getStoredSelectedProductIds() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    return storedValue ? JSON.parse(storedValue) : [];
  } catch (error) {
    return [];
  }
}

/* Save the current selection so it survives page refreshes */
function saveSelectedProducts() {
  const selectedIds = selectedProducts.map((product) => product.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
}

/* Restore the saved selections after the products finish loading */
function restoreSelectedProducts() {
  const storedIds = getStoredSelectedProductIds();
  selectedProducts = allProducts.filter((product) =>
    storedIds.includes(product.id),
  );
}

/* Check whether a product is already selected */
function isSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

/* Filter products by the current category and search input */
function getFilteredProducts() {
  const selectedCategory = normalizeText(currentFilters.category);
  const searchTerm = normalizeText(currentFilters.search);

  return allProducts.filter((product) => {
    const productCategory = normalizeText(product.category);
    const productName = normalizeText(product.name);
    const productDescription = normalizeText(product.description);

    const categoryMatches =
      !selectedCategory || productCategory === selectedCategory;
    const searchMatches =
      !searchTerm ||
      productName.includes(searchTerm) ||
      productDescription.includes(searchTerm) ||
      productCategory.includes(searchTerm);

    return categoryMatches && searchMatches;
  });
}

/* Render the product grid, including the selected state on each card */
function renderProducts() {
  const filteredProducts = getFilteredProducts();
  const hasActiveFilters = currentFilters.category || currentFilters.search;

  if (!hasActiveFilters) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Search or choose a category to view products.
      </div>
    `;
    return;
  }

  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your search.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = filteredProducts
    .map(
      (product) => `
        <article
          class="product-card ${isSelected(product.id) ? "selected" : ""}"
          data-product-id="${product.id}"
          tabindex="0"
          role="button"
          aria-pressed="${isSelected(product.id)}"
        >
          ${isSelected(product.id) ? '<span class="selected-badge">Selected (✓)</span>' : ""}
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
          <div class="product-info">
            <div>
              <h3>${escapeHtml(product.name)}</h3>
              <p class="product-brand">${escapeHtml(product.brand)}</p>
            </div>
            <div class="product-actions">
              <button type="button" class="view-details-btn" data-action="view-details">
                View Details
              </button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

/* Render the selected products list and keep the clear button in sync */
function renderSelectedProductsListView() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <div class="selected-empty-state">No products selected yet.</div>
    `;
    clearAllButton.hidden = true;
    generateRoutineButton.disabled = true;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-item" data-product-id="${product.id}">
          <span>${escapeHtml(product.name)}</span>
          <button type="button" class="remove-selected-btn" data-action="remove-selected" aria-label="Remove ${escapeHtml(product.name)}">
            &times;
          </button>
        </div>
      `,
    )
    .join("");

  clearAllButton.hidden = false;
  generateRoutineButton.disabled = false;
}

/* Keep the product grid and selected list aligned after every update */
function syncUi() {
  renderProducts();
  renderSelectedProductsListView();
}

/* Show a short toast after a product is added */
function showToast(message) {
  toastContainer.textContent = message;
  toastContainer.classList.add("is-visible");

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = window.setTimeout(() => {
    toastContainer.classList.remove("is-visible");
  }, 1800);
}

/* Add a brief motion cue to the card and selected list item */
function animateCardState(productId, stateClass) {
  const card = productsContainer.querySelector(
    `[data-product-id="${productId}"]`,
  );
  const selectedItem = selectedProductsList.querySelector(
    `[data-product-id="${productId}"]`,
  );

  if (card) {
    card.classList.add(stateClass);
    window.setTimeout(() => {
      card.classList.remove(stateClass);
    }, 220);
  }

  if (selectedItem) {
    selectedItem.classList.add(stateClass);
    window.setTimeout(() => {
      selectedItem.classList.remove(stateClass);
    }, 220);
  }
}

/* Find a product object by ID */
function getProductById(productId) {
  return allProducts.find((product) => product.id === productId);
}

/* Build the payload that gets sent to the Worker */
function buildSelectedProductPayload() {
  return selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
    image: product.image,
  }));
}

/* Build a request body with the message history and selected products */
function buildRequestBody(messagesToSend) {
  return {
    messages: messagesToSend,
    selectedProducts: buildSelectedProductPayload(),
  };
}

/* Choose the Worker endpoint for the current chat message */
function getChatEndpoint(messageText) {
  const normalizedMessage = normalizeText(messageText);

  if (
    normalizedMessage.startsWith("/web-search ") ||
    normalizedMessage.startsWith("search:")
  ) {
    return "/web-search";
  }

  return "/chat";
}

/* Send JSON to the Worker and return the assistant reply text */
async function sendRequestToBackend(endpoint, payload) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("The server returned an error.");
  }

  const data = await response.json();
  return getAssistantReply(data);
}

/* Add or remove a product from the selection */
function toggleProductSelection(productId) {
  const numericProductId = Number(productId);
  const selectedIndex = selectedProducts.findIndex(
    (product) => product.id === numericProductId,
  );
  const product = getProductById(numericProductId);

  if (selectedIndex >= 0) {
    animateCardState(numericProductId, "is-removing");

    if (removalTimeoutId) {
      window.clearTimeout(removalTimeoutId);
    }

    removalTimeoutId = window.setTimeout(() => {
      selectedProducts = selectedProducts.filter(
        (selectedProduct) => selectedProduct.id !== numericProductId,
      );
      saveSelectedProducts();
      syncUi();
    }, 180);
    return;
  }

  if (!product) {
    return;
  }

  selectedProducts.push(product);
  saveSelectedProducts();
  syncUi();
  animateCardState(numericProductId, "is-adding");
  showToast(`${product.name} added to your selection.`);
}

/* Remove one product from the selected list */
function removeSelectedProduct(productId) {
  const numericProductId = Number(productId);
  animateCardState(numericProductId, "is-removing");
  selectedProducts = selectedProducts.filter(
    (product) => product.id !== numericProductId,
  );
  saveSelectedProducts();
  syncUi();
}

/* Clear every selected product at once */
function clearSelectedProducts() {
  selectedProducts = [];
  saveSelectedProducts();
  syncUi();
}

/* Open the modal and show a product's full description */
function openProductModal(product) {
  modalContent.innerHTML = `
    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="modal-image" />
    <p class="modal-brand">${escapeHtml(product.brand)}</p>
    <h3 id="productModalTitle">${escapeHtml(product.name)}</h3>
    <p class="modal-category">${escapeHtml(product.category)}</p>
    <p class="modal-description">${escapeHtml(product.description)}</p>
  `;

  modalOverlay.classList.add("is-open");
}

/* Close the modal when the overlay, button, or Escape key is used */
function closeProductModal() {
  modalOverlay.classList.remove("is-open");
}

/* Update the loading bubble shown in the chat window */
function setLoadingState(active, text) {
  loadingState = {
    active,
    text,
  };
  renderChatWindow();
}

/* Add a message to the conversation memory and re-render the chat */
function addMessage(role, content) {
  messages.push({ role, content });
  renderChatWindow();
}

/* Build the message list that gets sent to the backend */
function buildApiMessages() {
  return messages;
}

/* Extract the assistant reply from the API response */
function getAssistantReply(data) {
  return (
    data?.choices?.[0]?.message?.content ||
    data?.message?.content ||
    data?.response ||
    data?.content ||
    "I’m sorry, I couldn’t generate a response right now."
  );
}

/* Render the conversation bubbles and keep the window scrolled to the latest message */
function renderChatWindow() {
  if (messages.length === 0 && !loadingState.active) {
    chatWindow.innerHTML = `
      <div class="chat-placeholder">Start a conversation or generate a routine from your selected products.</div>
    `;
    return;
  }

  const messageMarkup = messages
    .map(
      (message) => `
        <div class="chat-message ${message.role}">
          <div class="chat-bubble">${escapeHtml(message.content).replaceAll("\n", "<br>")}</div>
        </div>
      `,
    )
    .join("");

  const loadingMarkup = loadingState.active
    ? `
      <div class="chat-message assistant loading-message">
        <div class="chat-bubble">${escapeHtml(loadingState.text)}</div>
      </div>
    `
    : "";

  chatWindow.innerHTML = `${messageMarkup}${loadingMarkup}`;
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Update the product filters whenever the category or search input changes */
function handleFilterChange() {
  currentFilters.category = categoryFilter.value;
  currentFilters.search = searchInput.value;
  renderProducts();
}

/* Handle clicks on product cards and their inner buttons */
function handleProductClick(event) {
  const actionButton = event.target.closest("[data-action]");
  const productCard = event.target.closest(".product-card");

  if (!productCard) {
    return;
  }

  const productId = Number(productCard.dataset.productId);

  if (actionButton?.dataset.action === "view-details") {
    event.stopPropagation();
    const product = getProductById(productId);

    if (product) {
      openProductModal(product);
    }

    return;
  }

  toggleProductSelection(productId);
}

/* Allow Enter and Space to select cards when the card has focus */
function handleProductKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  if (event.target.closest("button, a, input, textarea, select")) {
    return;
  }

  const productCard = event.target.closest(".product-card");

  if (!productCard) {
    return;
  }

  event.preventDefault();
  toggleProductSelection(Number(productCard.dataset.productId));
}

/* Handle remove buttons inside the selected list */
function handleSelectedProductsClick(event) {
  const actionButton = event.target.closest("[data-action]");

  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.action === "remove-selected") {
    const selectedItem = actionButton.closest(".selected-item");
    removeSelectedProduct(selectedItem.dataset.productId);
  }
}

/* Send the selected products to the backend so it can generate a routine */
async function handleGenerateRoutine() {
  if (selectedProducts.length === 0) {
    addMessage(
      "assistant",
      "Please select at least one product before generating a routine.",
    );
    return;
  }

  const routinePrompt = `Generate a routine using these selected products: ${selectedProducts
    .map((product) => product.name)
    .join(", ")}.`;

  addMessage("user", routinePrompt);
  setLoadingState(true, "Building your routine...");

  try {
    const assistantReply = await sendRequestToBackend("/generate-routine", {
      ...buildRequestBody(buildApiMessages()),
    });

    addMessage("assistant", assistantReply);
  } catch (error) {
    addMessage(
      "assistant",
      "Sorry, I could not generate a routine right now. Please try again.",
    );
  } finally {
    setLoadingState(false, "");
  }
}

/* Submit a normal chat question and keep the full conversation in memory */
async function handleChatSubmit(event) {
  event.preventDefault();

  const messageText = userInput.value.trim();

  if (!messageText) {
    return;
  }

  userInput.value = "";
  addMessage("user", messageText);
  setLoadingState(true, "Thinking...");

  try {
    const assistantReply = await sendRequestToBackend(
      getChatEndpoint(messageText),
      {
        ...buildRequestBody(buildApiMessages()),
      },
    );

    addMessage("assistant", assistantReply);
  } catch (error) {
    addMessage(
      "assistant",
      "Sorry, I could not answer that right now. Please try again.",
    );
  } finally {
    setLoadingState(false, "");
  }
}

/* Close the modal when the overlay or close button is clicked */
function handleModalClick(event) {
  if (event.target === modalOverlay || event.target === modalCloseButton) {
    closeProductModal();
  }
}

/* Close the modal when the Escape key is pressed */
function handleDocumentKeydown(event) {
  if (event.key === "Escape") {
    closeProductModal();
  }
}

/* Load data, restore selections, and render the first view */
async function initializeApp() {
  try {
    allProducts = await loadProducts();
    restoreSelectedProducts();
    renderProducts();
    renderSelectedProductsListView();
    renderChatWindow();
    searchInput.focus();
  } catch (error) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        We could not load the product catalog right now.
      </div>
    `;
  }
}

/* Wire up the page */
categoryFilter.addEventListener("change", handleFilterChange);
searchInput.addEventListener("input", handleFilterChange);
productsContainer.addEventListener("click", handleProductClick);
productsContainer.addEventListener("keydown", handleProductKeydown);
selectedProductsList.addEventListener("click", handleSelectedProductsClick);
clearAllButton.addEventListener("click", clearSelectedProducts);
generateRoutineButton.addEventListener("click", handleGenerateRoutine);
chatForm.addEventListener("submit", handleChatSubmit);
modalOverlay.addEventListener("click", handleModalClick);
modalCloseButton.addEventListener("click", closeProductModal);
document.addEventListener("keydown", handleDocumentKeydown);

initializeApp();
