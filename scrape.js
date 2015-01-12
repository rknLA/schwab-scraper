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

var scrapedTransactions = [];

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
  page.evaluate(function(username, password, CSS){
    $(CSS.login.usernameField).val(username);
    $(CSS.login.passwordField).val(password);
    submitLogin();
  }, username, password, CSS);

  // timeout and kill phantom if we haven't logged in successfully after
  // 5 seconds.
  setLoadTimeout("Timed out loading logged in page. Quitting.", 5000);
};

var navigateToAccount = function() {
  // I only have one Bank Account there now, so I'm not yet bothering to make
  // this something that iterates over the accounts.
  console.log("Navigating to account page");
  page.evaluate(function(CSS){
    window.setTimeout(function() {
      $(document).ready(function() {
        var accountNodes = $(CSS.overview.accountLink);
        var href = accountNodes[0].href;
        console.log("account href: ", href);
        eval(href);
      });
    }, 3000);
  }, CSS);

  // timeout and kill phantom if we haven't logged in successfully after
  // 5 seconds.
  setLoadTimeout("Timed out loading account page. Quitting.", 6000);
};

var scrapeAccountPage = function() {
  console.log("Scraping account page");
  var transactions = page.evaluate(function(CSS) {
    var transactions = [];
    var rows = document.querySelectorAll(CSS.account.transactionRow);
    var i;
    var foundPendingTransactions = false;
    var foundPostedTransactions = false;
    for (i = 0; i < rows.length; ++i) {
      var row = rows[i];
      var numChildren = row.children.length;

      // first row should have 3 children, followed by rows of 15 children,
      // followed by another header of 3 children that is the Posted
      // Transactions header.  We want all the rows after that last one.
      if (!foundPendingTransactions) {
        if (numChildren == 1) {
          foundPendingTransactions = true;
        }
        continue;
      }

      if (!foundPostedTransactions) {
        if (numChildren == 1) {
          foundPostedTransactions = true;
        }
        continue;
      }

      if (numChildren != 7) {
        console.log("Found an anomalie in row " + i + ". Row has "
            + numChildren + " children instead of 7");
      }

      // table format is DATE, TYPE, Check #, Descr, Withdr, Depos, Balance
      var transaction = {
        'date': row.children[0].innerText,
        'type': row.children[1].innerText,
        'checkNumber': row.children[2].innerText,
        'description': row.children[3].innerText,
        'withdrawal': row.children[4].innerText,
        'deposit': row.children[5].innerText,
        'balance': row.children[6].innerText
      };
      transactions.push(transaction)

      console.log(JSON.stringify(transaction));
    }
    return transactions;
  }, CSS);

  console.log(JSON.stringify(transactions));

  console.log('exiting');
  phantom.exit();
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
      navigateToAccount();
    } else {
      console.log("Invalid login");
      phantom.exit();
    }
  } else if (currentState == STATES.loggedin) {
    if (targetUrl == SCHWAB_HISTORY_URL) {
      clearLoadTimeout();
      currentState = STATES.account;
      console.log('loaded account page');
    } else {
      console.log('error loading account page');
      phantom.exit()
    }
  }
};

page.onLoadFinished = function(status) {
  if (currentState == STATES.account) {
    scrapeAccountPage();
  };
};

// debugging.
page.onConsoleMessage = function(msg) {
  system.stderr.writeLine('console: ' + msg);
};
