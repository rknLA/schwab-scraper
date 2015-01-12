console.log('Beginning Schwab Scraper...');

var SCHWAB_LOGIN_URL = "https://www.schwab.com/public/schwab/client_home"

var page = require('webpage').create();
page.open(SCHWAB_LOGIN_URL, function(status) {
  console.log(status);
  phantom.exit();
});
