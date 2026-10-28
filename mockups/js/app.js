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

const frame = document.querySelector('.device');
if (frame) {
  const aspectWidth = 400;
  const aspectHeight = 1280;

  const lockFrameAspectRatio = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scale = Math.min(viewportWidth / aspectWidth, viewportHeight / aspectHeight);
    const width = Math.max(1, aspectWidth * scale);
    const height = Math.max(1, aspectHeight * scale);

    frame.style.width = `${width.toFixed(2)}px`;
    frame.style.height = `${height.toFixed(2)}px`;
  };

  lockFrameAspectRatio();
  window.addEventListener('resize', lockFrameAspectRatio);
}
