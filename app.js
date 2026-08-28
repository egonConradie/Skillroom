const workshops = [
  { id: 1, title: 'Robotics Basics with Arduino', category: 'Technology', host: 'Lethu M.', initials: 'LM', date: 'Sat, 05 Sep · 10:00', location: 'Stellenbosch', price: 550, image: 'assets/images/robotics.jpg', availability: '3 spots left', status: 'almost', description: 'Build and program a small Arduino-powered robot while learning practical electronics, sensors and simple movement.' },
  { id: 2, title: 'Web Development Fundamentals', category: 'Technology', host: 'Sipho D.', initials: 'SD', date: 'Sun, 06 Sep · 09:30', location: 'Somerset West', price: 650, image: 'assets/images/web-development.jpg', availability: '8 spots', status: '', description: 'Create and publish your first responsive web page using HTML, CSS and JavaScript in a friendly, practical workshop.' },
  { id: 3, title: '3D Printing for Beginners', category: 'Technology', host: 'Marco R.', initials: 'MR', date: 'Sat, 12 Sep · 11:00', location: 'Stellenbosch', price: 600, image: 'assets/images/printing.jpg', availability: '5 spots', status: '', description: 'Move from a simple digital model to a finished print, with hands-on setup, slicing and printer troubleshooting.' },
  { id: 4, title: 'Electronics Essentials: Build & Code', category: 'Technology', host: 'Ayesha K.', initials: 'AK', date: 'Sun, 13 Sep · 10:00', location: 'Cape Town', price: 600, image: 'assets/images/electronics.jpg', availability: '2 spots left', status: 'almost', description: 'Understand components, breadboards and circuits by building a working project you can take home.' },
  { id: 5, title: 'Leather Goods Workshop', category: 'Craft', host: 'Thandi P.', initials: 'TP', date: 'Sat, 19 Sep · 14:00', location: 'Cape Town', price: 500, image: 'assets/images/leather.jpg', availability: '6 spots', status: '', description: 'Cut, stitch and finish your own useful leather piece using traditional hand tools and durable techniques.' },
  { id: 6, title: 'Pottery for Beginners', category: 'Craft', host: 'Lerato M.', initials: 'LM', date: 'Sun, 20 Sep · 11:00', location: 'Somerset West', price: 550, image: 'assets/images/pottery.jpg', availability: '3 of 5 needed', status: '', description: 'Learn the feel of clay, wheel basics and simple shaping in a calm, welcoming studio session.' },
  { id: 7, title: 'Intro to Woodworking', category: 'Craft', host: 'Johan S.', initials: 'JS', date: 'Sat, 26 Sep · 10:00', location: 'Stellenbosch', price: 600, image: 'assets/images/woodwork.jpg', availability: '4 spots', status: '', description: 'Measure, cut, plane and assemble a small wooden project while learning safe tool handling.' },
  { id: 8, title: 'Macramé Plant Hanger Workshop', category: 'Craft', host: 'Zanele N.', initials: 'ZN', date: 'Sun, 27 Sep · 13:00', location: 'Helderberg', price: 450, image: 'assets/images/macrame.jpg', availability: 'Almost full', status: 'almost', description: 'Master a small set of beautiful knots and leave with a handmade plant hanger ready for your home.' },
];

const state = {
  category: 'All',
  search: '',
  saved: new Set(JSON.parse(localStorage.getItem('skillroomSaved') || '[]')),
  activeModal: null,
  lastFocused: null,
};

const grid = document.querySelector('#workshops');
const resultsNote = document.querySelector('#resultsNote');
const emptyState = document.querySelector('#emptyState');
const backdrop = document.querySelector('#modalBackdrop');
const publicSite = document.querySelector('#publicSite');
const adminView = document.querySelector('#adminView');
const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function cardMarkup(workshop) {
  const saved = state.saved.has(workshop.id);
  return `
    <article class="workshop-card" data-id="${workshop.id}" tabindex="0" aria-label="View ${workshop.title}">
      <div class="card-image">
        <img src="${workshop.image}" alt="${workshop.title} workshop" loading="lazy" />
        <button class="save-button ${saved ? 'is-saved' : ''}" data-save="${workshop.id}" aria-label="${saved ? 'Remove' : 'Save'} ${workshop.title}" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button>
        <span class="stamp ${workshop.category === 'Craft' ? 'craft' : ''}">${workshop.category === 'Technology' ? 'Tech' : workshop.category}</span>
        <span class="availability ${workshop.status}">${workshop.availability}</span>
      </div>
      <div class="card-body">
        <h3>${workshop.title}</h3>
        <div class="host-line"><span class="host-avatar">${workshop.initials}</span><span>By ${workshop.host}</span></div>
        <div class="card-meta">
          <span><b aria-hidden="true">▣</b>${workshop.date}</span>
          <span class="card-bottom"><span><b aria-hidden="true">⌖</b>${workshop.location}</span><strong class="price">R${workshop.price}</strong></span>
        </div>
      </div>
    </article>`;
}

function renderWorkshops() {
  const query = state.search.trim().toLowerCase();
  const filtered = workshops.filter((workshop) => {
    const categoryMatch = state.category === 'All' || workshop.category === state.category;
    const searchMatch = !query || `${workshop.title} ${workshop.location} ${workshop.host}`.toLowerCase().includes(query);
    return categoryMatch && searchMatch;
  });
  grid.innerHTML = filtered.map(cardMarkup).join('');
  grid.hidden = filtered.length === 0;
  emptyState.hidden = filtered.length !== 0;
  resultsNote.textContent = `${filtered.length} ${filtered.length === 1 ? 'workshop' : 'workshops'} shown${state.category === 'All' ? '' : ` in ${state.category}`}`;
}

function setCategory(category) {
  state.category = category;
  document.querySelectorAll('[data-category]').forEach((button) => {
    const selected = button.dataset.category === category;
    button.classList.toggle('is-active', selected);
    if (button.classList.contains('category-button')) button.setAttribute('aria-pressed', String(selected));
  });
  renderWorkshops();
  document.querySelector('.sidebar').classList.remove('is-open');
  document.querySelector('#menuButton').setAttribute('aria-expanded', 'false');
}

function openModal(id, trigger = document.activeElement) {
  closeModal(false);
  const modal = document.querySelector(`#${id}`);
  state.activeModal = modal;
  state.lastFocused = trigger;
  backdrop.hidden = false;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => modal.querySelector(focusableSelector)?.focus(), 0);
}

function closeModal(restoreFocus = true) {
  if (!state.activeModal) return;
  state.activeModal.hidden = true;
  backdrop.hidden = true;
  document.body.style.overflow = '';
  const returnFocus = state.lastFocused;
  state.activeModal = null;
  if (restoreFocus) returnFocus?.focus();
}

function openWorkshop(id, trigger) {
  const workshop = workshops.find((item) => item.id === Number(id));
  if (!workshop) return;
  document.querySelector('#modalWorkshopImage').src = workshop.image;
  document.querySelector('#modalWorkshopImage').alt = `${workshop.title} workshop`;
  const category = document.querySelector('#modalWorkshopCategory');
  category.textContent = workshop.category;
  category.className = `stamp ${workshop.category === 'Craft' ? 'craft' : ''}`;
  document.querySelector('#modalWorkshopAvailability').textContent = workshop.availability;
  document.querySelector('#modalWorkshopTitle').textContent = workshop.title;
  document.querySelector('#modalWorkshopDescription').textContent = workshop.description;
  document.querySelector('#modalWorkshopDate').textContent = workshop.date;
  document.querySelector('#modalWorkshopLocation').textContent = workshop.location;
  document.querySelector('#modalWorkshopHost').textContent = workshop.host;
  document.querySelector('#modalWorkshopPrice').textContent = `R${workshop.price} per person`;
  openModal('workshopModal', trigger);
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2800);
}

function renderAdminRows() {
  document.querySelector('#adminWorkshopRows').innerHTML = workshops.slice(0, 6).map((item, index) => `
    <tr><td><strong>${item.title}</strong><small>${item.category} · ${item.location}</small></td><td>${item.date}</td><td>${index % 3 + 3} / ${index % 2 ? 8 : 10}</td><td><span class="status-badge">Published</span></td><td><button class="row-action" data-row-action="${item.id}">Edit</button></td></tr>`).join('');
}

function enterAdmin() {
  localStorage.setItem('skillroomAdminSession', 'demo');
  closeModal(false);
  publicSite.hidden = true;
  adminView.hidden = false;
  renderAdminRows();
  window.scrollTo(0, 0);
  document.querySelector('#adminHeading').focus?.();
}

function leaveAdmin() {
  adminView.hidden = true;
  publicSite.hidden = false;
  window.scrollTo(0, 0);
}

document.addEventListener('click', (event) => {
  const categoryButton = event.target.closest('[data-category]');
  if (categoryButton) setCategory(categoryButton.dataset.category);

  const saveButton = event.target.closest('[data-save]');
  if (saveButton) {
    event.stopPropagation();
    const id = Number(saveButton.dataset.save);
    state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
    localStorage.setItem('skillroomSaved', JSON.stringify([...state.saved]));
    renderWorkshops();
    showToast(state.saved.has(id) ? 'Workshop saved' : 'Workshop removed from saved');
    return;
  }

  const card = event.target.closest('.workshop-card');
  if (card) openWorkshop(card.dataset.id, card);
  if (event.target.closest('[data-close-modal]') || event.target === backdrop) closeModal();

  const interest = event.target.closest('[data-interest]');
  if (interest) {
    interest.textContent = 'Interest noted ✓';
    interest.disabled = true;
    showToast(`We’ll keep you posted about ${interest.dataset.interest}.`);
  }

  const rowAction = event.target.closest('[data-row-action]');
  if (rowAction) showToast('Workshop editor preview — full publishing comes in the next build.');
});

grid.addEventListener('keydown', (event) => {
  const card = event.target.closest('.workshop-card');
  if (card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openWorkshop(card.dataset.id, card);
  }
});

document.querySelector('#searchInput').addEventListener('input', (event) => { state.search = event.target.value; renderWorkshops(); });
document.querySelector('#clearFiltersButton').addEventListener('click', () => { document.querySelector('#searchInput').value = ''; state.search = ''; setCategory('All'); });
document.querySelector('#signInButton').addEventListener('click', (event) => openModal('loginModal', event.currentTarget));
document.querySelector('#hostButton').addEventListener('click', (event) => openModal('hostModal', event.currentTarget));
document.querySelector('#footerHostButton').addEventListener('click', (event) => openModal('hostModal', event.currentTarget));
document.querySelector('#menuButton').addEventListener('click', (event) => {
  const sidebar = document.querySelector('.sidebar');
  const open = sidebar.classList.toggle('is-open');
  event.currentTarget.setAttribute('aria-expanded', String(open));
});
document.querySelector('#reserveButton').addEventListener('click', () => showToast('Booking will be connected in the next phase.'));
document.querySelector('#viewSiteButton').addEventListener('click', leaveAdmin);
document.querySelector('#signOutButton').addEventListener('click', () => { localStorage.removeItem('skillroomAdminSession'); leaveAdmin(); showToast('Signed out of the demo admin.'); });
document.querySelector('#addWorkshopButton').addEventListener('click', (event) => openModal('adminActionModal', event.currentTarget));

document.querySelector('#loginForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const email = document.querySelector('#emailInput').value.trim().toLowerCase();
  const password = document.querySelector('#passwordInput').value;
  const error = document.querySelector('#loginError');
  if (email === 'admin@skillroom.co.za' && password === 'Skillroom123') {
    error.textContent = '';
    enterAdmin();
  } else {
    error.textContent = 'Those demo details do not match. Use the credentials shown below.';
    document.querySelector('#emailInput').focus();
  }
});

document.querySelector('#hostForm').addEventListener('submit', (event) => { event.preventDefault(); closeModal(false); event.currentTarget.reset(); showToast('Thanks — your workshop enquiry has been captured in this demo.'); });
document.querySelector('#addWorkshopForm').addEventListener('submit', (event) => { event.preventDefault(); closeModal(false); event.currentTarget.reset(); showToast('Draft workshop saved in this prototype.'); });

['manageCategoriesButton','featureButton','enquiryButton','exportButton'].forEach((id) => {
  document.querySelector(`#${id}`).addEventListener('click', () => showToast('This admin action is ready for backend connection.'));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
  if (event.key === 'Tab' && state.activeModal) {
    const focusable = [...state.activeModal.querySelectorAll(focusableSelector)].filter((element) => !element.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

renderWorkshops();
