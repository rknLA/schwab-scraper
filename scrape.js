console.log('Beginning Schwab Scraper...');

var page = require('webpage').create()
  , system = require('system')

var SCHWAB_LOGIN_URL = "https://www.schwab.com/public/schwab/client_home"
  , JQUERY_URL = "https://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js"
  , SCHWAB_LOGGED_IN_URL = "https://client.schwab.com/Accounts/Summary/Summary.aspx?ShowUN=YES"
  , SCHWAB_HISTORY_URL = "https://client.schwab.com/Accounts/History/BankHistory.aspx"

var CSS = {
  'account': {
    'nextLink': "a:contains('Next>')",
    'transactionRow': '#tblTransaction .data-row', // this includes headers n such
  },
  'login': {
    'usernameField': '#SignonAccountNumber',
    'passwordField': '#SignonPassword',
  },
  'overview': {
    'accountLink': '.section-bank .data-row #spanOverlayAccountId a'
  }
}

var STATES = {
  'loading': 'loading',
  'home': 'home',
  'loggedin': 'loggedin',
  'account': 'account'
};
var currentState = STATES.loading;

var loadingTimeout;

var setLoadTimeout = function(message, time) {
  if (loadingTimeout) {
    window.clearTimeout(loadingTimeout);
  }
  loadingTimeout = window.setTimeout(function() {
    console.log(message);
    phantom.exit();
  }, time);
};

var clearLoadTimeout = function() {
  window.clearTimeout(loadingTimeout);
  loadingTimeout = null;
};

var login = function(page, username, password) {
  page.evaluate(function(username, password){
    $(CSS.login.usernameField).val(username);
    $(CSS.login.passwordField).val(password);
    submitLogin();
  }, username, password);

  // timeout and kill phantom if we haven't logged in successfully after
  // 5 seconds.
  setLoadTimeout("Timed out loading logged in page. Quitting.", 5000);
};

var scrapeAccount = function() {
  // I only have one Bank Account there now, so I'm not yet bothering to make
  // this something that iterates over the accounts.
  console.log("Attempting to scrape account.");
  page.evaluate(function(){
    window.setTimeout(function() {
      $(document).ready(function() {
        var accountNodes = $(CSS.overview.accountLink);
        var href = accountNodes[0].href;
        console.log("account href: ", href);
        eval(href);
      });
    }, 1000);
  });

  // timeout and kill phantom if we haven't logged in successfully after
  // 5 seconds.
  setLoadTimeout("Timed out loading account page. Quitting.", 5000);
};


page.open(SCHWAB_LOGIN_URL, function(status) {
  if (status != 'success') {
    console.log('Error loading Schwab page');
    phantom.exit();
  }
  currentState = STATES.home;

  page.includeJs(JQUERY_URL, function() {
    console.log("Please enter your username: ");
    var username = system.stdin.readLine();
    console.log("Please enter your password: ");
    var password = system.stdin.readLine();

    login(page, username, password);
  });
});

page.onUrlChanged = function(targetUrl) {
  if (currentState == STATES.home) {
    if (targetUrl == SCHWAB_LOGGED_IN_URL) {
      currentState = STATES.loggedin
      clearLoadTimeout();
      console.log("Loaded logged in page");
      scrapeAccount();
    } else {
      console.log("Invalid login");
      phantom.exit();
    }
  } else if (currentState == STATES.loggedin) {
    if (targetUrl == SCHWAB_HISTORY_URL) {
      clearLoadTimeout();
      console.log('loaded account page');
    } else {
      console.log('error loading account page');
    }
    phantom.exit()
  }
};
