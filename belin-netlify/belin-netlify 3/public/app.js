
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
        <span>${esc(icon)}</span>
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
        toggle.textContent = "☰";
      }
    });
  }

  // Контакты по умолчанию
  function defaultContacts() {
    return `
      <a href="mailto:belin@belin.su">✉ belin@belin.su</a>
      <a href="tel:+79000758850">☎ +7 900 075-88-50</a>
      <a href="https://belin.su">↗ belin.su</a>
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
            ✉ ${esc(settings.email)}
          </a>
        `);
      }

      if (settings.phone) {
        const phone = String(settings.phone).replace(/[^+\d]/g, "");

        contacts.push(`
          <a href="tel:${esc(phone)}">
            ☎ ${esc(settings.phone)}
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
            ↗ Написать в Telegram
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
                : `<div class="project-placeholder">✦</div>`
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
                      Открыть проект ↗
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
            <div style="color:#2478ff">❝</div>
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
