var config = {
  "framework": "qunit",
  "host": "127.0.0.1",
  "test_page": "tests/index.html?hidepassed",
  "disable_watching": true,
  "launch_in_ci": [
    "Headless Chrome"
  ],
  "launch_in_dev": [
    "Headless Chrome"
  ],
  "browser_args": {
    "Headless Chrome": [
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--disable-background-networking",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--do-not-de-elevate"
    ]
  }
};

if (process.env.CHROME_BIN) {
  config.browser_paths = {
    "Headless Chrome": process.env.CHROME_BIN
  };
}

module.exports = config;
