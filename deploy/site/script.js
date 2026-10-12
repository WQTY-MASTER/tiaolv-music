'use strict';

document.documentElement.classList.add('js-ready');
const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', '打开导航');
}
menuToggle.hidden = false;
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  navigation.classList.toggle('is-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuToggle.focus();
  }
});
document.addEventListener('click', event => { if (!event.target.closest('.header-inner')) closeMenu(); });
window.matchMedia('(max-width: 580px)').addEventListener('change', closeMenu);

const dialog = document.querySelector('#screenshot-dialog');
if (typeof dialog.showModal === 'function') {
  document.querySelectorAll('.screenshot-link').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      document.querySelector('#screenshot-full').src = link.href;
      document.querySelector('#screenshot-full').alt = link.querySelector('img').alt;
      document.querySelector('#screenshot-caption').textContent = link.dataset.caption;
      document.querySelector('#screenshot-original').href = link.href;
      dialog.showModal();
      document.body.classList.add('dialog-open');
    });
  });
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
}

const copyButton = document.querySelector('#copy-download');
const copyStatus = document.querySelector('#copy-status');
const addressInput = document.querySelector('#download-address');
// 只用于复制链接；页面原有安装包入口仍保留相对路径。
const downloadUrl = new URL(document.querySelector('a[download]').getAttribute('href'), 'https://wqty.online/').href;
copyButton.hidden = false;
copyButton.addEventListener('click', async () => {
  addressInput.value = downloadUrl;
  copyButton.disabled = true;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(downloadUrl);
    copyStatus.textContent = '下载链接已复制，可发送到 Windows 电脑。';
    addressInput.hidden = true;
  } catch {
    addressInput.hidden = false;
    addressInput.focus();
    addressInput.select();
    copyStatus.textContent = '请复制下方已选中的下载地址。';
  } finally {
    copyButton.disabled = false;
  }
});

document.querySelector('#copyright-year').textContent = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date());
