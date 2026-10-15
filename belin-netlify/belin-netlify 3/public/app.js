
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const belinIcon = c => { const icons = {'↗': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="M5 13 13 5M6 5h7v7"/></svg>', '➜': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="M3 9h12m-5-5 5 5-5 5"/></svg>', '✦': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="m9 1.5 2.1 5.4L16.5 9l-5.4 2.1L9 16.5l-2.1-5.4L1.5 9l5.4-2.1Z"/></svg>', '✧': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="m9 1.5 2.1 5.4L16.5 9l-5.4 2.1L9 16.5l-2.1-5.4L1.5 9l5.4-2.1Z"/></svg>', '✳': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="M9 2v14M2 9h14M4 4l10 10M14 4 4 14"/></svg>', '◉': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><circle cx="9" cy="9" r="6"/><circle cx="9" cy="9" r="2"/></svg>', '◇': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="m9 2 7 7-7 7-7-7Z"/></svg>', '⌘': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="M6 6h6v6H6zM6 6C1 6 1 2.5 4 2.5S6 6 6 6Zm6 0s0-3.5 2-3.5S17 6 12 6ZM6 12s0 3.5-2 3.5S1 12 6 12Zm6 0s5 0 5 3.5-5 0-5-3.5Z"/></svg>', '▦': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><rect x="2" y="2" width="14" height="14" rx="1"/><path d="M2 7h14M7 2v14"/></svg>', '▣': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><rect x="2" y="2" width="14" height="14" rx="1"/><rect x="5" y="5" width="8" height="8" rx="1"/></svg>', '⌂': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="m2 9 7-6 7 6M4 8v8h10V8M7 16v-5h4v5"/></svg>', '⚙': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><circle cx="9" cy="9" r="2.5"/><path d="M9 1v2m0 12v2M1 9h2m12 0h2M3.3 3.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4M4.7 13.3l-1.4 1.4"/></svg>', '✉': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><rect x="2" y="4" width="14" height="10" rx="2"/><path d="m2 5 7 5 7-5"/></svg>', '☎': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="M5 2h3l1 4-2 2c1 2 2 3 4 4l2-2 4 1v3c0 2-2 3-4 2C7 14 3 10 2 5 1.5 3 3 2 5 2Z"/></svg>', '✓': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="m3 9 4 4 8-8"/></svg>', '◈': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="m9 1 7 8-7 8-7-8Z"/><path d="m9 5 3 4-3 4-3-4Z"/></svg>', '▤': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><rect x="2" y="2" width="14" height="14" rx="1"/><path d="M5 6h8M5 9h8M5 12h5"/></svg>', '▧': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><rect x="2" y="2" width="14" height="14" rx="1"/><path d="M9 2v14M2 7h14"/></svg>', '❝': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="M7 5H4l-2 4v5h6V8H5m11-3h-3l-2 4v5h6V8h-3"/></svg>', '⌄': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="m4 7 5 5 5-5"/></svg>', '▥': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><rect x="2" y="2" width="14" height="14" rx="1"/><path d="M5 5h8M5 8h8M5 11h8"/></svg>', '☰': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="M2 5h14M2 9h14M2 13h14"/></svg>'}; return icons[c] || c; };

  const industries = [
    ["⌂", "Строительство", "41.20"],
    ["✳", "Клининг", "81.21"],
    ["⚙", "Автосервис", "45.20"],
    ["➜", "Грузоперевозки", "49.41"],
    ["◉", "Кафе и рестораны", "56.10"],
    ["✦", "Салоны красоты", "96.02"],
    ["◇", "Рекламные агентства", "73.11"],
    ["⌘", "IT-компании", "62.01"],
    ["▦", "Интернет-магазины", "47.91"],
    ["▣", "Ремонт техники", "95.11"]
  ];

  // Отображаем элементы сразу, без скрывающих анимаций.
  function observe() {
    document.querySelectorAll(".reveal").forEach(element => {
      element.classList.add("visible");
    });
  }

  // Дополнительная защита: если другие скрипты
  // добавят карточки позже, они тоже станут видимыми.
  const visibilityObserver = new MutationObserver(() => {
    observe();
  });

  visibilityObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Отрасли
  const industryList = $("#industry-list");

  if (industryList) {
    industryList.innerHTML = industries.map(([icon, name, code]) => `
      <div class="industry reveal visible">
        <span>${belinIcon(icon)}</span>
        <strong>${esc(name)}</strong>
        <small>ОКВЭД ${esc(code)}</small>
      </div>
    `).join("");
  }

  // Год в подвале
  const year = $("#year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // Мобильное меню
  const navlinks = $("#navlinks");
  const toggle = $("#nav-toggle") || $(".nav-toggle");

  if (navlinks) {
    navlinks.addEventListener("click", event => {
      if (!event.target.closest("a")) return;

      navlinks.classList.remove("open");

      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "${belinIcon('☰')}";
      }
    });
  }

  // Контакты по умолчанию
  function defaultContacts() {
    return `
      <a href="mailto:belin@belin.su">${belinIcon('✉')} belin@belin.su</a>
      <a href="tel:+79000758850">${belinIcon('☎')} +7 900 075-88-50</a>
      <a href="https://belin.su">${belinIcon('↗')} belin.su</a>
    `;
  }

  // Загрузка данных из Supabase через API
  async function load() {
    try {
      const response = await fetch("/api/public", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const settings = data.settings || {};
      const projects = Array.isArray(data.projects)
        ? data.projects
        : [];
      const testimonials = Array.isArray(data.testimonials)
        ? data.testimonials
        : [];

      // Описание главного экрана
      const heroDescription = $("#hero-description");

      if (heroDescription && settings.heroDescription) {
        heroDescription.textContent = settings.heroDescription;
      }

      // Контакты
      const contacts = [];

      if (settings.email) {
        contacts.push(`
          <a href="mailto:${encodeURIComponent(settings.email)}">
            ${belinIcon('✉')} ${esc(settings.email)}
          </a>
        `);
      }

      if (settings.phone) {
        const phone = String(settings.phone).replace(/[^+\d]/g, "");

        contacts.push(`
          <a href="tel:${esc(phone)}">
            ${belinIcon('☎')} ${esc(settings.phone)}
          </a>
        `);
      }

      if (
        settings.telegram &&
        /^https:\/\/(t\.me|telegram\.me)\//.test(settings.telegram)
      ) {
        contacts.push(`
          <a href="${esc(settings.telegram)}"
             target="_blank"
             rel="noopener noreferrer">
            ${belinIcon('↗')} Написать в Telegram
          </a>
        `);
      }

      if (settings.address) {
        contacts.push(`<span>${esc(settings.address)}</span>`);
      }

      const contactLinks = $("#contact-links");

      if (contactLinks) {
        contactLinks.innerHTML = contacts.length
          ? contacts.join("")
          : defaultContacts();
      }

      // Кейсы
      const projectsContainer = $("#projects");

      if (projectsContainer && projects.length) {
        projectsContainer.innerHTML = projects.map(project => `
          <article class="project-card reveal visible">
            ${
              project.image
                ? `<img
                    src="${esc(project.image)}"
                    alt="${esc(project.title)}"
                    loading="lazy"
                  >`
                : `<div class="project-placeholder">${belinIcon('✦')}</div>`
            }

            <div class="project-body">
              <span>${esc(project.category)}</span>
              <h3>${esc(project.title)}</h3>
              <p>${esc(project.description)}</p>

              ${
                /^https:\/\//.test(project.url || "")
                  ? `<a
                      href="${esc(project.url)}"
                      target="_blank"
                      rel="noopener noreferrer">
                      Открыть проект ${belinIcon('↗')}
                    </a>`
                  : ""
              }
            </div>
          </article>
        `).join("");
      }

      // Отзывы
      const testimonialsContainer = $("#testimonials");

      if (testimonialsContainer && testimonials.length) {
        testimonialsContainer.className = "review-grid";

        testimonialsContainer.innerHTML = testimonials.map(review => `
          <article class="review-card reveal visible">
            <div style="color:#2478ff">${belinIcon('❝')}</div>
            <p>${esc(review.body)}</p>
            <strong>${esc(review.name)}</strong>
            <br>
            <span>${esc(review.role)}</span>
          </article>
        `).join("");
      }

      // Управление формой заявок
      const form = $("#lead-form");

      if (form && settings.formsEnabled !== "true") {
        const button = form.querySelector('button[type="submit"]');
        const message = $("#form-message");

        if (button) {
          button.disabled = true;
          button.textContent = "Форма временно недоступна";
        }

        if (message) {
          message.textContent =
            "Перед запуском формы администратор должен опубликовать политику обработки данных и включить приём заявок.";
        }
      }

      observe();

    } catch (error) {
      console.warn("Не удалось загрузить данные сайта:", error);

      const contactLinks = $("#contact-links");

      if (contactLinks) {
        contactLinks.innerHTML = defaultContacts();
      }

      const form = $("#lead-form");

      if (form) {
        const button = form.querySelector('button[type="submit"]');

        if (button) {
          button.disabled = true;
          button.textContent = "Приём заявок пока не настроен";
        }
      }

      const message = $("#form-message");

      if (message) {
        message.textContent =
          "Пока форма не подключена, напишите нам на belin@belin.su.";
      }

      observe();
    }
  }

  // Отправка заявок
  const leadForm = $("#lead-form");

  if (leadForm) {
    leadForm.addEventListener("submit", async event => {
      event.preventDefault();

      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const status = $("#form-message");

      if (!button) return;

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      data.consent = Boolean(form.elements.consent?.checked);

      button.disabled = true;

      if (status) {
        status.textContent = "Отправляем...";
      }

      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Ошибка отправки");
        }

        if (status) {
          status.textContent =
            "Спасибо! Заявка получена. Мы свяжемся с вами.";
        }

        form.reset();

      } catch (error) {
        if (status) {
          status.textContent = error.message;
        }

      } finally {
        button.disabled = false;
      }
    });
  }

  // Первоначальное отображение
  observe();

  // Загрузка динамического контента
  load();

})();
