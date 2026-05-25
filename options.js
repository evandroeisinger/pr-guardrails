'use strict';

const STORAGE_KEY = 'pmgSettings';
const DEFAULTS = { blockedDays: [5], warnOnOthersPR: true };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function renderDays(selected) {
  const root = document.getElementById('days');
  root.innerHTML = '';
  DAY_NAMES.forEach((name, idx) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = String(idx);
    input.checked = selected.includes(idx);
    input.addEventListener('change', save);
    const span = document.createElement('span');
    span.textContent = name;
    label.appendChild(input);
    label.appendChild(span);
    root.appendChild(label);
  });
}

function readDays() {
  return Array.from(document.querySelectorAll('#days input:checked')).map((i) => Number(i.value));
}

function load() {
  chrome.storage.sync.get([STORAGE_KEY], (res) => {
    const s = { ...DEFAULTS, ...(res[STORAGE_KEY] || {}) };
    document.getElementById('warnOnOthersPR').checked = s.warnOnOthersPR;
    renderDays(s.blockedDays);
  });
}

function save() {
  const settings = {
    blockedDays: readDays(),
    warnOnOthersPR: document.getElementById('warnOnOthersPR').checked,
  };
  chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Saved.';
    setTimeout(() => { status.textContent = ''; }, 1200);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  document.getElementById('warnOnOthersPR').addEventListener('change', save);
});
