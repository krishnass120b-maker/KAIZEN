/*
  KAIZEN & CO. / Nourish & Co. premium storefront interactions
  -------------------------------------------------------------
  Add this file as script.js at the end of your HTML body:

  <script src="script.js"></script>

  It works with the HTML you shared and does not need a framework.
*/

(() => {
  "use strict";

  const CART_STORAGE_KEY = "nourish-premium-cart-v1";
  const NEWSLETTER_STORAGE_KEY = "nourish-newsletter-email-v1";
  const FREE_SHIPPING_THRESHOLD = 999;
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const productDetails = {
    "Berry Bright": {
      description: "A bright berry-and-beet blend designed for easy, everyday protein.",
      benefit: "Naturally vibrant energy",
    },
    "Cacao Calm": {
      description: "Rich cacao and maca make this your smooth, chocolatey reset.",
      benefit: "A calm chocolate ritual",
    },
    "Daily Greens": {
      description: "A fresh, minty blend for bringing a little more green to your day.",
      benefit: "A refreshing daily reset",
    },
    "Vanilla Oat": {
      description: "Creamy vanilla and oats that turn a busy morning into a better one.",
      benefit: "Comforting, steady fuel",
    },
    "Mango Glow": {
      description: "Tropical mango with turmeric for a sunny, satisfying shake.",
      benefit: "Golden-hour goodness",
    },
    "Coffee Boost": {
      description: "Arabica coffee and oats for a balanced lift without the fuss.",
      benefit: "A smoother morning lift",
    },
  };

  let cart = loadCart();
  let activeQuickViewProduct = null;
  let lastCartTrigger = null;
  let lastQuickViewTrigger = null;
  let toastTimer;

  document.addEventListener("DOMContentLoaded", initialise, { once: true });

  function initialise() {
    injectEnhancementStyles();

    const elements = {
      body: document.body,
      header: document.querySelector(".site-header"),
      cartButton: document.querySelector(".cart-button"),
      cartDrawer: document.querySelector(".cart-drawer"),
      closeCartButton: document.querySelector(".close-cart"),
      scrim: document.querySelector(".scrim"),
      cartCount: document.querySelector(".cart-count"),
      drawerCount: document.querySelector(".drawer-count"),
      cartItems: document.querySelector(".cart-items"),
      cartTotal: document.querySelector(".cart-total"),
      cartFooter: document.querySelector(".cart-footer"),
      checkoutButton: document.querySelector(".checkout-button"),
      toast: document.querySelector(".toast"),
      menuButton: document.querySelector(".menu-button"),
      mainNav: document.querySelector(".main-nav"),
      filterRow: document.querySelector(".filter-row"),
      filters: [...document.querySelectorAll(".filter")],
      productCards: [...document.querySelectorAll(".product-card")],
      productCarousel: document.querySelector(".product-carousel"),
      productGrid: document.querySelector(".product-grid"),
      previousButton: document.querySelector(".slider-prev"),
      nextButton: document.querySelector(".slider-next"),
      newsletterForm: document.querySelector(".email-form"),
      newsletterEmail: document.querySelector("#email"),
      newsletterMessage: document.querySelector(".form-message"),
      year: document.querySelector("#year"),
    };

    if (elements.year) elements.year.textContent = new Date().getFullYear();

    const quickView = createQuickView();
    const pageTopButton = createPageTopButton();
    const scrollProgress = createScrollProgress();

    setupCart(elements, quickView);
    setupProducts(elements, quickView);
    setupFilters(elements);
    setupCarousel(elements);
    setupNavigation(elements);
    setupNewsletter(elements);
    setupScrollEnhancements(elements, pageTopButton, scrollProgress);
    setupRevealAnimations();
    setupGlobalKeyboardHandling(elements, quickView);

    renderCart(elements);
  }

  /* ---------------------------------------------------------------------- */
  /* Cart                                                                   */
  /* ---------------------------------------------------------------------- */

  function setupCart(elements, quickView) {
    const {
      cartButton,
      cartDrawer,
      closeCartButton,
      scrim,
      cartItems,
      checkoutButton,
    } = elements;

    if (!cartButton || !cartDrawer || !cartItems) return;

    cartButton.addEventListener("click", () => {
      openCart(elements, quickView, cartButton);
    });

    closeCartButton?.addEventListener("click", () => closeCart(elements));
    scrim?.addEventListener("click", () => closeCart(elements));

    cartItems.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cart-action]");
      if (!button) return;

      const sku = button.dataset.sku;
      const action = button.dataset.cartAction;
      const cartItem = cart.find((item) => item.sku === sku);
      if (!cartItem) return;

      if (action === "increase") cartItem.quantity += 1;
      if (action === "decrease") cartItem.quantity -= 1;
      if (action === "remove") cartItem.quantity = 0;

      cart = cart.filter((item) => item.quantity > 0);
      saveCart();
      renderCart(elements);

      if (action === "remove") showToast(elements, `${cartItem.name} removed from your bag.`, "neutral");
    });

    checkoutButton?.addEventListener("click", () => {
      if (!cart.length) {
        showToast(elements, "Your bag is waiting for something good.", "neutral");
        return;
      }

      const total = getSubtotal();
      showToast(
        elements,
        `Your order total is ${formatMoney(total)}. Connect this button to Razorpay or Stripe to accept payment.`,
        "success"
      );
    });
  }

  function openCart(elements, quickView, trigger) {
    if (quickView.classList.contains("is-open")) closeQuickView(elements, quickView, false);

    lastCartTrigger = trigger || document.activeElement;
    elements.cartDrawer.classList.add("is-open", "open");
    elements.cartDrawer.setAttribute("aria-hidden", "false");
    elements.cartButton?.setAttribute("aria-expanded", "true");
    elements.scrim?.classList.add("is-visible", "visible");
    syncBodyLock(elements, quickView);

    window.setTimeout(() => elements.closeCartButton?.focus(), 60);
  }

  function closeCart(elements, returnFocus = true) {
    elements.cartDrawer?.classList.remove("is-open", "open");
    elements.cartDrawer?.setAttribute("aria-hidden", "true");
    elements.cartButton?.setAttribute("aria-expanded", "false");
    elements.scrim?.classList.remove("is-visible", "visible");
    syncBodyLock(elements, document.querySelector(".quick-view"));

    if (returnFocus && lastCartTrigger instanceof HTMLElement) lastCartTrigger.focus();
  }

  function addToCart(elements, product) {
    const existingItem = cart.find((item) => item.sku === product.sku);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        sku: product.sku,
        name: product.name,
        price: product.price,
        type: product.type,
        quantity: 1,
      });
    }

    saveCart();
    renderCart(elements);
    pulseCart(elements.cartButton);
    showToast(elements, `${product.name} is in your bag.`, "success");
  }

  function renderCart(elements) {
    const { cartCount, drawerCount, cartTotal, cartItems, cartFooter } = elements;
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = getSubtotal();

    if (cartCount) cartCount.textContent = itemCount;
    if (drawerCount) drawerCount.textContent = itemCount;
    if (cartTotal) cartTotal.textContent = formatMoney(subtotal);

    if (cartItems) {
      cartItems.innerHTML = cart.length
        ? cart
            .map(
              (item) => `
                <article class="cart-line-item">
                  <div class="cart-line-item__copy">
                    <p class="cart-line-item__type">${escapeHtml(item.type || "Nourish blend")}</p>
                    <h3>${escapeHtml(item.name)}</h3>
                    <strong>${formatMoney(item.price)}</strong>
                  </div>
                  <div class="cart-line-item__controls" aria-label="Quantity for ${escapeHtml(item.name)}">
                    <button type="button" data-cart-action="decrease" data-sku="${escapeHtml(item.sku)}" aria-label="Remove one ${escapeHtml(item.name)}">−</button>
                    <span aria-label="Quantity">${item.quantity}</span>
                    <button type="button" data-cart-action="increase" data-sku="${escapeHtml(item.sku)}" aria-label="Add one ${escapeHtml(item.name)}">+</button>
                    <button class="cart-line-item__remove" type="button" data-cart-action="remove" data-sku="${escapeHtml(item.sku)}">Remove</button>
                  </div>
                </article>
              `
            )
            .join("")
        : '<p class="empty-cart">Your bag is waiting for something good.</p>';
    }

    if (cartFooter) {
      let shippingNote = cartFooter.querySelector(".shipping-note");
      if (!shippingNote) {
        shippingNote = document.createElement("p");
        shippingNote.className = "shipping-note";
        cartFooter.prepend(shippingNote);
      }

      if (subtotal === 0) {
        shippingNote.textContent = `Free delivery on orders over ${formatMoney(FREE_SHIPPING_THRESHOLD)}.`;
      } else if (subtotal < FREE_SHIPPING_THRESHOLD) {
        shippingNote.textContent = `Add ${formatMoney(FREE_SHIPPING_THRESHOLD - subtotal)} for free delivery.`;
      } else {
        shippingNote.textContent = "You unlocked free delivery — lovely choice.";
      }
    }
  }

  function getSubtotal() {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function loadCart() {
    try {
      const storedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
      if (!Array.isArray(storedCart)) return [];

      return storedCart
        .filter(
          (item) =>
            item &&
            typeof item.name === "string" &&
            typeof item.sku === "string" &&
            Number.isFinite(Number(item.price)) &&
            Number.isFinite(Number(item.quantity))
        )
        .map((item) => ({
          sku: item.sku,
          name: item.name,
          type: item.type || "Nourish blend",
          price: Number(item.price),
          quantity: Math.max(1, Math.min(99, Number(item.quantity))),
        }));
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // The shop still works if browser storage is disabled.
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Products and quick view                                                */
  /* ---------------------------------------------------------------------- */

  function setupProducts(elements, quickView) {
    elements.productCards.forEach((card) => {
      const product = productFromCard(card);
      const visual = card.querySelector(".product-visual");
      const addButton = card.querySelector(".add-button");

      if (visual) {
        const quickViewButton = document.createElement("button");
        quickViewButton.className = "quick-view-trigger";
        quickViewButton.type = "button";
        quickViewButton.innerHTML = '<span>Quick view</span><b aria-hidden="true">↗</b>';
        quickViewButton.setAttribute("aria-label", `Quick view: ${product.name}`);
        visual.append(quickViewButton);

        quickViewButton.addEventListener("click", (event) => {
          event.stopPropagation();
          openQuickView(elements, quickView, product, quickViewButton);
        });
      }

      addButton?.addEventListener("click", () => {
        addToCart(elements, product);
        temporarilyConfirmButton(addButton);
      });
    });

    quickView.addEventListener("click", (event) => {
      if (event.target === quickView || event.target.closest("[data-close-quick-view]")) {
        closeQuickView(elements, quickView);
        return;
      }

      if (event.target.closest("[data-quick-add]")) {
        if (!activeQuickViewProduct) return;
        addToCart(elements, activeQuickViewProduct);
        temporarilyConfirmButton(event.target.closest("[data-quick-add]"));
      }
    });
  }

  function productFromCard(card) {
    const displayedName = card.querySelector(".product-info h3")?.textContent.trim();
    const name = card.dataset.product || displayedName || "Nourish blend";
    const displayedPrice = card.querySelector(".product-info > strong")?.textContent.replace(/[^\d.]/g, "");
    const price = Number(card.dataset.price || displayedPrice || 0);
    const type = card.querySelector(".product-info p")?.textContent.trim() || "Nourish blend";

    return {
      sku: slugify(name),
      name,
      price,
      type,
      card,
      description: productDetails[name]?.description || "A nourishing blend made for your everyday rhythm.",
      benefit: productDetails[name]?.benefit || "Simply good nourishment",
    };
  }

  function createQuickView() {
    const quickView = document.createElement("section");
    quickView.className = "quick-view";
    quickView.setAttribute("aria-hidden", "true");
    quickView.setAttribute("aria-label", "Product preview");
    document.body.append(quickView);
    return quickView;
  }

  function openQuickView(elements, quickView, product, trigger) {
    if (elements.cartDrawer?.classList.contains("is-open")) closeCart(elements, false);

    activeQuickViewProduct = product;
    lastQuickViewTrigger = trigger || document.activeElement;
    renderQuickView(quickView, product);
    quickView.classList.add("is-open");
    quickView.setAttribute("aria-hidden", "false");
    syncBodyLock(elements, quickView);

    window.setTimeout(() => quickView.querySelector("[data-close-quick-view]")?.focus(), 60);
  }

  function renderQuickView(quickView, product) {
    quickView.innerHTML = `
      <div class="quick-view__dialog" role="dialog" aria-modal="true" aria-labelledby="quick-view-title">
        <button class="quick-view__close" type="button" data-close-quick-view aria-label="Close product preview">×</button>
        <div class="quick-view__art" aria-hidden="true"></div>
        <div class="quick-view__content">
          <p class="eyebrow">${escapeHtml(product.type)}</p>
          <h2 id="quick-view-title">${escapeHtml(product.name)}</h2>
          <p class="quick-view__description">${escapeHtml(product.description)}</p>
          <div class="quick-view__price-row">
            <strong>${formatMoney(product.price)}</strong>
            <span>${escapeHtml(product.benefit)}</span>
          </div>
          <ul class="quick-view__benefits">
            <li><span>✓</span> 31g protein</li>
            <li><span>✓</span> Real ingredients</li>
            <li><span>✓</span> No artificial sweeteners</li>
          </ul>
          <button class="button button-dark quick-view__add" type="button" data-quick-add>
            Add to bag <span>+</span>
          </button>
        </div>
      </div>
    `;

    const artworkDestination = quickView.querySelector(".quick-view__art");
    const artwork = product.card.querySelector(".product-visual")?.cloneNode(true);
    artwork?.querySelector(".quick-view-trigger")?.remove();
    if (artwork) artworkDestination.append(artwork);
  }

  function closeQuickView(elements, quickView, returnFocus = true) {
    quickView.classList.remove("is-open");
    quickView.setAttribute("aria-hidden", "true");
    activeQuickViewProduct = null;
    syncBodyLock(elements, quickView);

    if (returnFocus && lastQuickViewTrigger instanceof HTMLElement) lastQuickViewTrigger.focus();
  }

  function temporarilyConfirmButton(button) {
    if (!button) return;

    const originalHTML = button.dataset.originalHtml || button.innerHTML;
    button.dataset.originalHtml = originalHTML;
    button.classList.add("is-added");
    button.disabled = true;
    button.innerHTML = 'Added <span aria-hidden="true">✓</span>';

    window.clearTimeout(button.confirmationTimer);
    button.confirmationTimer = window.setTimeout(() => {
      button.classList.remove("is-added");
      button.disabled = false;
      button.innerHTML = originalHTML;
    }, 900);
  }

  /* ---------------------------------------------------------------------- */
  /* Filtering and product carousel                                         */
  /* ---------------------------------------------------------------------- */

  function setupFilters(elements) {
    const { filters, productCards, filterRow } = elements;
    if (!filters.length) return;

    const status = document.createElement("p");
    status.className = "sr-only filter-status";
    status.setAttribute("aria-live", "polite");
    filterRow?.append(status);

    filters.forEach((filter) => {
      filter.setAttribute("aria-pressed", filter.classList.contains("active") ? "true" : "false");

      filter.addEventListener("click", () => {
        const requestedFilter = filter.dataset.filter || "all";

        filters.forEach((item) => {
          const isActive = item === filter;
          item.classList.toggle("active", isActive);
          item.setAttribute("aria-pressed", String(isActive));
        });

        let visibleCount = 0;
        productCards.forEach((card, index) => {
          const categories = (card.dataset.category || "").split(/\s+/);
          const isVisible = requestedFilter === "all" || categories.includes(requestedFilter);

          card.hidden = !isVisible;
          card.setAttribute("aria-hidden", String(!isVisible));

          if (isVisible) {
            visibleCount += 1;
            if (!REDUCED_MOTION && typeof card.animate === "function") {
              card.animate(
                [
                  { opacity: 0, transform: "translateY(14px)" },
                  { opacity: 1, transform: "translateY(0)" },
                ],
                { duration: 280, delay: index * 45, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" }
              );
            }
          }
        });

        status.textContent = `${visibleCount} ${visibleCount === 1 ? "blend" : "blends"} shown.`;
      });
    });
  }

  function setupCarousel(elements) {
    const { productCarousel, productGrid, previousButton, nextButton } = elements;
    if (!productCarousel || !productGrid) return;

    const scrollContainer = productCarousel.scrollWidth > productCarousel.clientWidth ? productCarousel : productGrid;
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const cardStep = () => {
      const card = productGrid.querySelector(".product-card:not([hidden])");
      if (!card) return 320;
      const styles = window.getComputedStyle(productGrid);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return card.getBoundingClientRect().width + gap;
    };

    const updateControls = () => {
      const maximumScroll = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
      if (previousButton) previousButton.disabled = scrollContainer.scrollLeft <= 4;
      if (nextButton) nextButton.disabled = scrollContainer.scrollLeft >= maximumScroll - 4;
    };

    previousButton?.addEventListener("click", () => {
      scrollContainer.scrollBy({ left: -cardStep(), behavior: REDUCED_MOTION ? "auto" : "smooth" });
    });

    nextButton?.addEventListener("click", () => {
      scrollContainer.scrollBy({ left: cardStep(), behavior: REDUCED_MOTION ? "auto" : "smooth" });
    });

    scrollContainer.addEventListener("scroll", updateControls, { passive: true });
    window.addEventListener("resize", updateControls, { passive: true });
    window.setTimeout(updateControls, 100);

    scrollContainer.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      isDragging = true;
      startX = event.clientX;
      startScrollLeft = scrollContainer.scrollLeft;
      scrollContainer.classList.add("is-dragging");
      scrollContainer.setPointerCapture?.(event.pointerId);
    });

    scrollContainer.addEventListener("pointermove", (event) => {
      if (!isDragging) return;
      const distance = event.clientX - startX;
      if (Math.abs(distance) > 4) event.preventDefault();
      scrollContainer.scrollLeft = startScrollLeft - distance;
    });

    const stopDragging = () => {
      isDragging = false;
      scrollContainer.classList.remove("is-dragging");
    };

    scrollContainer.addEventListener("pointerup", stopDragging);
    scrollContainer.addEventListener("pointercancel", stopDragging);
    scrollContainer.addEventListener("pointerleave", stopDragging);
  }

  /* ---------------------------------------------------------------------- */
  /* Navigation, newsletter, and page polish                                */
  /* ---------------------------------------------------------------------- */

  function setupNavigation(elements) {
    const { menuButton, mainNav } = elements;

    menuButton?.addEventListener("click", () => {
      const isOpen = mainNav?.classList.toggle("is-open");
      mainNav?.classList.toggle("open", Boolean(isOpen));
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    });

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "start" });

        mainNav?.classList.remove("is-open", "open");
        menuButton?.setAttribute("aria-expanded", "false");
        menuButton?.setAttribute("aria-label", "Open menu");
      });
    });
  }

  function setupNewsletter(elements) {
    const { newsletterForm, newsletterEmail, newsletterMessage } = elements;
    if (!newsletterForm || !newsletterEmail || !newsletterMessage) return;

    newsletterForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = newsletterEmail.value.trim();

      if (!newsletterEmail.validity.valid) {
        newsletterEmail.setAttribute("aria-invalid", "true");
        newsletterMessage.textContent = "Please enter a valid email address.";
        newsletterMessage.dataset.state = "error";
        newsletterEmail.focus();
        return;
      }

      try {
        localStorage.setItem(NEWSLETTER_STORAGE_KEY, email);
      } catch {
        // Newsletter confirmation remains available without storage.
      }

      newsletterForm.reset();
      newsletterEmail.removeAttribute("aria-invalid");
      newsletterMessage.textContent = "You’re on the list. Good things are coming.";
      newsletterMessage.dataset.state = "success";
      showToast(elements, "Welcome to the Nourish circle.", "success");
    });
  }

  function setupScrollEnhancements(elements, pageTopButton, scrollProgress) {
    const updateScrollUI = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, window.scrollY / maxScroll);

      elements.header?.classList.toggle("is-scrolled", window.scrollY > 16);
      pageTopButton.classList.toggle("is-visible", window.scrollY > 640);
      scrollProgress.style.transform = `scaleX(${progress})`;
    };

    window.addEventListener("scroll", updateScrollUI, { passive: true });
    updateScrollUI();

    pageTopButton.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: REDUCED_MOTION ? "auto" : "smooth" });
    });
  }

  function createPageTopButton() {
    const button = document.createElement("button");
    button.className = "page-top";
    button.type = "button";
    button.setAttribute("aria-label", "Back to top");
    button.innerHTML = '<span aria-hidden="true">↑</span>';
    document.body.append(button);
    return button;
  }

  function createScrollProgress() {
    const progress = document.createElement("div");
    progress.className = "scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    document.body.prepend(progress);
    return progress;
  }

  function setupRevealAnimations() {
    const sections = [...document.querySelectorAll("main > section")];
    if (REDUCED_MOTION || !("IntersectionObserver" in window)) return;

    sections.forEach((section, index) => {
      section.classList.add("nourish-reveal");
      if (index === 0) section.classList.add("is-revealed");
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );

    sections.slice(1).forEach((section) => observer.observe(section));
  }

  function setupGlobalKeyboardHandling(elements, quickView) {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (quickView.classList.contains("is-open")) {
          closeQuickView(elements, quickView);
        } else if (elements.cartDrawer?.classList.contains("is-open")) {
          closeCart(elements);
        } else if (elements.mainNav?.classList.contains("is-open")) {
          elements.mainNav.classList.remove("is-open", "open");
          elements.menuButton?.setAttribute("aria-expanded", "false");
          elements.menuButton?.focus();
        }
        return;
      }

      if (event.key !== "Tab") return;
      const panel = quickView.classList.contains("is-open")
        ? quickView.querySelector(".quick-view__dialog")
        : elements.cartDrawer?.classList.contains("is-open")
          ? elements.cartDrawer
          : null;

      if (panel) trapFocus(event, panel);
    });
  }

  function trapFocus(event, container) {
    const focusable = [...container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((element) => element.offsetParent !== null);

    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Utilities                                                              */
  /* ---------------------------------------------------------------------- */

  function syncBodyLock(elements, quickView) {
    const isCartOpen = elements.cartDrawer?.classList.contains("is-open");
    const isQuickViewOpen = quickView?.classList.contains("is-open");
    elements.body?.classList.toggle("nourish-scroll-lock", Boolean(isCartOpen || isQuickViewOpen));
  }

  function showToast(elements, message, tone = "success") {
    const toast = elements.toast;
    if (!toast) return;

    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add("show", "is-visible");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("show", "is-visible");
    }, 3400);
  }

  function pulseCart(button) {
    if (!button || REDUCED_MOTION || typeof button.animate !== "function") return;
    button.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.09)" },
        { transform: "scale(1)" },
      ],
      { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character]);
  }

  /* Small visual layer for UI generated by this JavaScript. */
  function injectEnhancementStyles() {
    if (document.querySelector("#nourish-premium-interactions")) return;

    const style = document.createElement("style");
    style.id = "nourish-premium-interactions";
    style.textContent = `
      html { scroll-behavior: smooth; }
      body.nourish-scroll-lock { overflow: hidden; }

      .scroll-progress {
        position: fixed;
        z-index: 1000;
        inset: 0 0 auto;
        height: 3px;
        transform: scaleX(0);
        transform-origin: left;
        background: #2d5745;
        transition: transform .08s linear;
      }

      .site-header.is-scrolled {
        box-shadow: 0 9px 26px rgba(29, 45, 35, .10);
        background-color: rgba(255, 253, 247, .94);
        backdrop-filter: blur(15px);
      }

      .cart-drawer.is-open { transform: translateX(0); }
      .scrim.is-visible { opacity: 1; visibility: visible; pointer-events: auto; }

      .cart-line-item {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.1rem 0;
        border-bottom: 1px solid rgba(31, 51, 39, .12);
      }
      .cart-line-item__copy h3 { margin: .14rem 0 .38rem; font-size: 1rem; }
      .cart-line-item__copy strong { font-size: .93rem; }
      .cart-line-item__type {
        margin: 0;
        color: #718074;
        font-size: .68rem;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .cart-line-item__controls {
        display: grid;
        grid-template-columns: 28px 22px 28px;
        gap: .35rem;
        align-content: start;
        text-align: center;
      }
      .cart-line-item__controls button {
        min-width: 28px;
        min-height: 28px;
        border: 1px solid rgba(31, 51, 39, .2);
        border-radius: 50%;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
      }
      .cart-line-item__controls span { align-self: center; font-size: .9rem; }
      .cart-line-item__controls .cart-line-item__remove {
        grid-column: 1 / -1;
        width: auto;
        border: 0;
        border-radius: 0;
        margin-top: .2rem;
        color: #8a4638;
        font-size: .7rem;
        text-decoration: underline;
      }
      .shipping-note {
        margin: 0 0 .8rem;
        color: #547260;
        font-size: .78rem;
      }

      .toast {
        position: fixed;
        z-index: 1100;
        left: 50%;
        bottom: 1.35rem;
        max-width: min(92vw, 460px);
        padding: .85rem 1.15rem;
        border-radius: 999px;
        box-shadow: 0 12px 35px rgba(25, 42, 31, .2);
        background: #203e31;
        color: #fffdf7;
        font-size: .88rem;
        text-align: center;
        opacity: 0;
        pointer-events: none;
        transform: translate(-50%, 18px);
        transition: opacity .24s ease, transform .24s ease;
      }
      .toast[data-tone="neutral"] { background: #4f574d; }
      .toast.show, .toast.is-visible { opacity: 1; transform: translate(-50%, 0); }

      .quick-view-trigger {
        position: absolute;
        z-index: 2;
        right: .85rem;
        bottom: .85rem;
        display: inline-flex;
        align-items: center;
        gap: .55rem;
        padding: .58rem .78rem;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 253, 247, .96);
        color: #254334;
        box-shadow: 0 5px 18px rgba(28, 48, 36, .16);
        cursor: pointer;
        font: inherit;
        font-size: .72rem;
        opacity: 0;
        transform: translateY(6px);
        transition: opacity .2s ease, transform .2s ease, background .2s ease;
      }
      .product-card:hover .quick-view-trigger,
      .quick-view-trigger:focus-visible { opacity: 1; transform: translateY(0); }
      .quick-view-trigger:hover { background: #fff; }
      .quick-view-trigger b { font-size: .95rem; }
      .add-button.is-added, .quick-view__add.is-added { background: #547260; }

      .quick-view {
        position: fixed;
        z-index: 1050;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 1.25rem;
        overflow-y: auto;
        background: rgba(24, 38, 29, .52);
        opacity: 0;
        pointer-events: none;
        visibility: hidden;
        transition: opacity .24s ease, visibility .24s ease;
      }
      .quick-view.is-open { opacity: 1; pointer-events: auto; visibility: visible; }
      .quick-view__dialog {
        position: relative;
        display: grid;
        grid-template-columns: minmax(230px, .85fr) minmax(260px, 1fr);
        width: min(880px, 100%);
        overflow: hidden;
        border-radius: 22px;
        background: #fffdf7;
        box-shadow: 0 24px 70px rgba(20, 35, 25, .28);
        transform: translateY(15px) scale(.985);
        transition: transform .24s cubic-bezier(.2,.75,.2,1);
      }
      .quick-view.is-open .quick-view__dialog { transform: translateY(0) scale(1); }
      .quick-view__close {
        position: absolute;
        z-index: 3;
        top: .9rem;
        right: .9rem;
        width: 36px;
        height: 36px;
        border: 0;
        border-radius: 50%;
        background: rgba(255, 253, 247, .92);
        color: #243c2d;
        cursor: pointer;
        font-size: 1.45rem;
        line-height: 1;
      }
      .quick-view__art {
        display: grid;
        min-height: 380px;
        place-items: center;
        overflow: hidden;
      }
      .quick-view__art .product-visual {
        width: 100%;
        height: 100%;
        min-height: 380px;
      }
      .quick-view__content { padding: clamp(2.25rem, 5vw, 4.5rem) clamp(1.5rem, 4vw, 3.4rem); }
      .quick-view__content h2 { margin: .3rem 0 1rem; font-size: clamp(2rem, 4vw, 3.3rem); line-height: .98; }
      .quick-view__description { max-width: 35rem; margin: 0; color: #566357; line-height: 1.65; }
      .quick-view__price-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        margin: 1.6rem 0 1rem;
      }
      .quick-view__price-row strong { font-size: 1.32rem; }
      .quick-view__price-row span { color: #547260; font-size: .78rem; text-align: right; }
      .quick-view__benefits { display: grid; gap: .52rem; margin: 0 0 1.65rem; padding: 0; list-style: none; font-size: .88rem; }
      .quick-view__benefits span { color: #547260; font-weight: 800; }
      .quick-view__add { width: 100%; justify-content: center; }

      .page-top {
        position: fixed;
        z-index: 990;
        right: 1.25rem;
        bottom: 1.25rem;
        display: grid;
        width: 42px;
        height: 42px;
        place-items: center;
        border: 0;
        border-radius: 50%;
        box-shadow: 0 8px 24px rgba(24, 42, 30, .2);
        background: #254334;
        color: #fffdf7;
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transform: translateY(10px);
        transition: opacity .2s ease, transform .2s ease;
      }
      .page-top.is-visible { opacity: 1; pointer-events: auto; transform: translateY(0); }

      .product-carousel.is-dragging, .product-grid.is-dragging { cursor: grabbing; user-select: none; }
      .slider-arrow:disabled { cursor: not-allowed; opacity: .35; }
      .nourish-reveal { opacity: 0; transform: translateY(18px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.75,.2,1); }
      .nourish-reveal.is-revealed { opacity: 1; transform: translateY(0); }
      .form-message[data-state="success"] { color: #e8fff0; }
      .form-message[data-state="error"] { color: #ffd2ca; }

      button:focus-visible, a:focus-visible, input:focus-visible {
        outline: 3px solid #d69853;
        outline-offset: 3px;
      }

      @media (max-width: 720px) {
        .quick-view { align-items: end; padding: .75rem; }
        .quick-view__dialog { grid-template-columns: 1fr; max-height: calc(100vh - 1.5rem); overflow-y: auto; border-radius: 20px; }
        .quick-view__art, .quick-view__art .product-visual { min-height: 255px; }
        .quick-view__content { padding: 2rem 1.35rem 1.4rem; }
        .quick-view__content h2 { font-size: 2.35rem; }
        .quick-view-trigger { opacity: 1; transform: translateY(0); }
        .main-nav.is-open {
          position: absolute;
          top: calc(100% + .5rem);
          right: 1rem;
          left: 1rem;
          display: flex;
          flex-direction: column;
          gap: .95rem;
          padding: 1.15rem;
          border-radius: 14px;
          box-shadow: 0 14px 32px rgba(28, 45, 34, .14);
          background: #fffdf7;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
      }
    `;
    document.head.append(style);
  }
})();
// ...existing code...
  function setupProducts(elements, quickView) {
    elements.productCards.forEach((card) => {
      const product = productFromCard(card);
      const visual = card.querySelector(".product-visual");
      const addButton = card.querySelector(".add-button, [data-add-to-cart], .add-to-cart");

      if (visual) {
        const quickViewButton = document.createElement("button");
        quickViewButton.className = "quick-view-trigger";
        quickViewButton.type = "button";
        quickViewButton.innerHTML = '<span>Quick view</span><b aria-hidden="true">↗</b>';
        quickViewButton.setAttribute("aria-label", `Quick view: ${product.name}`);
        visual.append(quickViewButton);

        quickViewButton.addEventListener("click", (event) => {
          event.stopPropagation();
          openQuickView(elements, quickView, product, quickViewButton);
        });
      }

      addButton?.addEventListener("click", () => {
        addToCart(elements, product);
        temporarilyConfirmButton(addButton);
      });
    });

    quickView.addEventListener("click", (event) => {
      if (event.target === quickView || event.target.closest("[data-close-quick-view]")) {
        closeQuickView(elements, quickView);
        return;
      }

      if (event.target.closest("[data-quick-add]")) {
        if (!activeQuickViewProduct) return;
        addToCart(elements, activeQuickViewProduct);
        temporarilyConfirmButton(event.target.closest("[data-quick-add]"));
      }
    });
  }

  function productFromCard(card) {
    const displayedName = card.querySelector(".product-info h3")?.textContent.trim();
    const name = card.dataset.product || displayedName || "Nourish blend";
    const displayedPrice = card.querySelector(".product-info > strong")?.textContent.replace(/[^\d.]/g, "");
    const price = Number(card.dataset.price || displayedPrice || 0);
    const type = card.querySelector(".product-info p")?.textContent.trim() || "Nourish blend";

    return {
      sku: card.dataset.sku || slugify(name),
      name,
      price,
      type,
      card,
      description: productDetails[name]?.description || "A nourishing blend made for your everyday rhythm.",
      benefit: productDetails[name]?.benefit || "Simply good nourishment",
    };
  }
// ...existing code...
// ...existing code...
  function setupProducts(elements, quickView) {
    elements.productCards.forEach((card) => {
      const product = productFromCard(card);
      const visual = card.querySelector(".product-visual");
      const addButton = card.querySelector(".add-button, [data-add-to-cart], .add-to-cart");

      if (visual) {
        const quickViewButton = document.createElement("button");
        quickViewButton.className = "quick-view-trigger";
        quickViewButton.type = "button";
        quickViewButton.innerHTML = '<span>Quick view</span><b aria-hidden="true">↗</b>';
        quickViewButton.setAttribute("aria-label", `Quick view: ${product.name}`);
        visual.append(quickViewButton);

        quickViewButton.addEventListener("click", (event) => {
          event.stopPropagation();
          openQuickView(elements, quickView, product, quickViewButton);
        });
      }

      addButton?.addEventListener("click", () => {
        addToCart(elements, product);
        temporarilyConfirmButton(addButton);
      });
    });

    quickView.addEventListener("click", (event) => {
      if (event.target === quickView || event.target.closest("[data-close-quick-view]")) {
        closeQuickView(elements, quickView);
        return;
      }

      if (event.target.closest("[data-quick-add]")) {
        if (!activeQuickViewProduct) return;
        addToCart(elements, activeQuickViewProduct);
        temporarilyConfirmButton(event.target.closest("[data-quick-add]"));
      }
    });
  }

  function addToCart(elements, product) {
    const existingItem = cart.find((item) => item.sku === product.sku);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        sku: product.sku,
        name: product.name,
        price: product.price,
        type: product.type,
        quantity: 1,
      });
    }

    saveCart();
    renderCart(elements);
    pulseCart(elements.cartButton);
    showToast(elements, `${product.name} is in your bag.`, "success");
  }
// ...existing code...