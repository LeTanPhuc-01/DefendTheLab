// public/js/appMain.js

import { initWebTouchBridge } from 'webtouch-sdk';

// --- App’s pure business logic (copied from myApp.js) ---

const testForm = document.getElementById('testForm');
const testBox = document.getElementById('testBox');

function simulateFormClear(form) {
  console.log('Simulating form clear on submit...');
  form.elements['textField'].value = '';
  form.elements['textArea'].value = '';
  form.elements['radioGroup'].forEach(radio => {
    radio.checked = radio.value === 'opt2';
  });
  form.elements['checkItem1'].checked = false;
  form.elements['checkItem2'].checked = false;
  form.elements['checkItem3'].checked = true;
}

if (testBox) {
  testBox.addEventListener('click', () => {
    testBox.textContent = 'Clicked!';
    setTimeout(() => (testBox.textContent = 'Click Me!'), 1500);
  });
}

if (testForm) {
  testForm.addEventListener('submit', (e) => {
    e.preventDefault();
    simulateFormClear(testForm);
  });
}

// --- Attach the WebTouch DOM bridge from the SDK ---

initWebTouchBridge({
  cursorElement: document.getElementById('cursor'),
  qrCodeContainer: document.getElementById('qrCodeContainer'),
});
