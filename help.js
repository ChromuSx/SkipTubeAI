// Dark mode toggle - synchronized with extension settings
const darkModeToggle = document.getElementById('dark-mode-toggle');
const body = document.body;
const icon = darkModeToggle.querySelector('.material-icons');

// Load saved preference from chrome storage
chrome.storage.local.get(['darkMode'], (data) => {
  if (data.darkMode) {
    body.classList.add('dark-mode');
    icon.textContent = 'light_mode';
    darkModeToggle.title = 'Enable Light Mode';
  } else {
    icon.textContent = 'dark_mode';
    darkModeToggle.title = 'Enable Dark Mode';
  }
});

// Toggle dark mode
darkModeToggle.addEventListener('click', async () => {
  body.classList.toggle('dark-mode');
  const isNowDark = body.classList.contains('dark-mode');
  icon.textContent = isNowDark ? 'light_mode' : 'dark_mode';
  darkModeToggle.title = isNowDark ? 'Enable Light Mode' : 'Enable Dark Mode';

  // Save to chrome storage to sync with popup
  await chrome.storage.local.set({ darkMode: isNowDark });
});
