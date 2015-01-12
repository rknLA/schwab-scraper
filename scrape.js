console.log('Beginning Schwab Scraper...');

var page = require('webpage').create()
  , system = require('system')

var SCHWAB_LOGIN_URL = "https://www.schwab.com/public/schwab/client_home"
  , JQUERY_URL = "https://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js"
  , SCHWAB_LOGGED_IN_URL = "https://client.schwab.com/Accounts/Summary/Summary.aspx?ShowUN=YES";

var loginTimeout;

var login = function(page, username, password, callback) {
  page.evaluate(function(username, password){
    $('#SignonAccountNumber').val(username);
    $('#SignonPassword').val(password);
    submitLogin();
  }, username, password);

  // timeout and kill phantom if we haven't logged in successfully after
  // 5 seconds.
  loginTimeout = window.setTimeout(function() {
    console.log("Timed out loading logged in page. Quitting.");
    phantom.exit()
  }, 5000);
  callback();
};


page.open(SCHWAB_LOGIN_URL, function(status) {
  if (status != 'success') {
    console.log('Error loading Schwab page');
    phantom.exit();
  }

  page.includeJs(JQUERY_URL, function() {
    console.log("Please enter your username: ");
    var username = system.stdin.readLine();
    console.log("Please enter your password: ");
    var password = system.stdin.readLine();

    login(page, username, password, function() {
      console.log('done logging in');
      console.log('current page: ', page.url);
    });
  });
});

page.onUrlChanged = function(targetUrl) {
  if (targetUrl == SCHWAB_LOGGED_IN_URL) {
    console.log("Loaded logged in page");
    phantom.exit();
  } else {
    console.log("Invalid login");
    phantom.exit();
  }
};
