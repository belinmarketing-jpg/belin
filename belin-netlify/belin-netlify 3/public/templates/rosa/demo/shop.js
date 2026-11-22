import { products } from './products.js';
const root = document.body.dataset.root;
const key = 'belin-rosa-cart-v1';
const price = n => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
const count = document.querySelector('#count');
const notice = document.querySelector('#notice');
const checkout = document.querySelector('#checkout');
const order = document.querySelector('#order');
let timer;
let cart = {};
try {
  const saved = JSON.parse(localStorage.getItem(key) || '{}');
  cart = Object.fromEntries(Object.entries(saved).filter(([id, qty]) => Object.hasOwn(products,id) && Number.isInteger(qty) && qty > 0 && qty <= 99));
} catch {}
function render() {
  const entries = Object.entries(cart);
  count.textContent = entries.reduce((n,[,qty]) => n+qty,0);
  if (!checkout) return;
  document.querySelector('#empty').hidden = entries.length > 0;
  checkout.hidden = entries.length === 0;
  document.querySelector('#cart-items').innerHTML = entries.map(([id,qty]) => {
    const p = products[id];
    return `<article class="cart-row"><img src="${root}media/${p.image}.webp" alt=""><div><a href="${root}product/${id}/">${p.name}</a><p>${price(p.price*qty)}</p></div><div class="quantity"><button type="button" data-minus="${id}" aria-label="Уменьшить количество: ${p.name}">−</button><span>${qty}</span><button type="button" data-add="${id}" aria-label="Увеличить количество: ${p.name}">+</button></div></article>`;
  }).join('');
  const courier = order.elements.delivery.value === 'courier';
  order.querySelector('#address-wrap').hidden = !courier;
  order.elements.address.required = courier;
  order.elements.address.disabled = !courier;
  const total = entries.reduce((n,[id,qty]) => n + products[id].price*qty,0);
  document.querySelector('#total').textContent = 'Итого: ' + price(total+(courier&&entries.length?390:0));
  order.querySelector('output').textContent = '';
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-add],[data-minus]');
  if (!button) return;
  const id = button.dataset.add || button.dataset.minus;
  if (!Object.hasOwn(products, id)) return;
  const field = document.querySelector('#item-quantity');
  if (field && !field.reportValidity()) return;
  const amount = field?.valueAsNumber || 1;
  const qty = Math.min(99,(cart[id] || 0) + (button.dataset.add ? amount : -1));
  if (qty > 0) cart[id] = qty; else delete cart[id];
  try { localStorage.setItem(key,JSON.stringify(cart)); } catch {}
  render();
  if (checkout) checkout.querySelector(`[data-${button.dataset.add?'add':'minus'}="${id}"]`)?.focus();
  else {
    notice.textContent = qty === 99 ? 'Максимум 99 единиц в корзине' : products[id].name + ' · в корзине';
    clearTimeout(timer);
    timer = setTimeout(() => { notice.textContent = ''; }, 2200);
  }
});
order?.elements.delivery.addEventListener('change',render);
order?.addEventListener('submit',event => {
  event.preventDefault();
  order.querySelector('output').textContent = 'Демо-заказ проверен. Оплата не списана, данные не отправлены.';
});
const contact = document.querySelector('#contact-form');
contact?.addEventListener('submit',event => {
  event.preventDefault();
  contact.querySelector('output').textContent = 'Демо-заявка заполнена. Отправка отключена.';
});
render();

const sort = document.querySelector('#product-sort');
const grid = document.querySelector('#catalog-products');
if (sort && grid) {
  const initial = [...grid.children];
  const productPrice = card => products[card.querySelector('[data-add]').dataset.add].price;
  sort.addEventListener('change', () => {
    const cards = [...initial];
    if (sort.value !== 'default') {
      const direction = sort.value === 'asc' ? 1 : -1;
      cards.sort((a,b) => direction * (productPrice(a) - productPrice(b)));
    }
    grid.append(...cards);
  });
}


// Animate only when the visitor permits motion. Content is visible without JS.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const reveal = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.animate(
        [{ transform: 'translateY(12px)', opacity: .78 }, { transform: 'translateY(0)', opacity: 1 }],
        { duration: 430, easing: 'cubic-bezier(.2,.75,.3,1)' }
      );
      observer.unobserve(entry.target);
    }
  }, { threshold: .12 });
  document.querySelectorAll('main h1, .hero-image, .section h2, .categories, .products, .product-page img, .cart-layout .panel')
    .forEach(element => reveal.observe(element));
}
