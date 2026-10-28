const path = window.location.pathname;
const links = document.querySelectorAll('.nav a');
links.forEach((link) => {
  const href = link.getAttribute('href');
  if (path.endsWith(href)) {
    link.classList.add('active');
  }
});

const backButton = document.querySelector('.back-btn');
if (backButton) {
  backButton.addEventListener('click', (event) => {
    event.preventDefault();
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = 'index.html';
  });
}
