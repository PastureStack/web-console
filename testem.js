var config = {
  "framework": "qunit",
  "host": "127.0.0.1",
  "test_page": "tests/index.html?hidepassed",
  "disable_watching": true,
  "launch_in_ci": [
    "Chrome"
  ],
  "launch_in_dev": [
    "Chrome"
  ],
  "browser_args": {
    "Chrome": [
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--disable-background-networking",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=0"
    ]
  }
};

if (process.env.CHROME_BIN) {
  config.browser_paths = {
    "Chrome": process.env.CHROME_BIN
  };
}

module.exports = config;
