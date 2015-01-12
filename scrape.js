#!/usr/bin/env phantomjs
var page = require('webpage').create()
  , system = require('system')
  , fs = require('fs');

console.log('Beginning Schwab Scraper...');

// defaults
var DEBUG = false;
var OUT_FORMAT = 'csv';
var OUT_FILE = './transactions.csv';
var STOP_DATE = new Date('2014-09-01')

/*
if (argv._ === undefined || argv._.length != 1) {
  console.log("Usage: phantomjs --ssl-protocol=any scrape.js [options] outfile");
  phantom.exit();
}

OUT_FILE = argv._[0];

if (argv.format) {
  if (argv.format != 'json' || argv.format != 'csv') {
    console.log("Usage: phantomjs --ssl-protocol=any scrape.js [options] outfile");
    console.log("The --format argument only supports 'json' or 'csv'.");
    phantom.exit();
  }
  OUT_FORMAT = argv.format
}

if (argv.debug) {
  DEBUG = true;
}
*/



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
  var transactionInfo = page.evaluate(function(CSS) {
    var transactions = [];
    var rows = document.querySelectorAll(CSS.account.transactionRow);
    var i;
    var foundPendingTransactions = false;
    var foundPostedTransactions = false;

    var earliestDate = new Date('2020-01-01');

    for (i = 0; i < rows.length; ++i) {
      var row = rows[i];
      var numChildren = row.children.length;

      // first row should have 3 children, followed by rows of 15 children,
      // followed by another header of 3 children that is the Posted
      // Transactions header.  We want all the rows after that last one.
      if (!foundPendingTransactions) {
        if (numChildren == 1) {
          foundPendingTransactions = true;

          //but, the subsequent pages don't have pending transactions...
          var text = row.innerText;
          if ((text.indexOf("Posted") > -1) &&
              (text.indexOf("Pending") == -1)) {
            foundPostedTransactions = true;
          }
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

      transactionDate = new Date(transaction.date);
      if (transactionDate < earliestDate) {
        earliestDate = transactionDate;
      }
    }

    return {
      'transactions': transactions,
      'earliest': earliestDate
    }
  }, CSS);


  scrapedTransactions = scrapedTransactions.concat(transactionInfo.transactions);

  console.log("Scraped back to " + transactionInfo.earliest);
  if (STOP_DATE < transactionInfo.earliest) {
    console.log("Stop date is " + STOP_DATE + ", so we keep going");
    // keep scraping.
    console.log("Continuing to the next page");
    page.evaluate(function(CSS) {
      var link = $(CSS.account.nextLink)[0];
      console.log('link is: ', link);
      var href = link.href;
      eval(href);
    }, CSS);
  } else {
    serializeTransactions(scrapedTransactions);
    console.log('Done!');
    phantom.exit();
  }
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
  console.log("URL changed: ", targetUrl);
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
  console.log("Load finished: ", status);
  if (currentState == STATES.account) {
    scrapeAccountPage();
  };
};

// debugging.
page.onConsoleMessage = function(msg) {
  if (DEBUG) {
    system.stderr.writeLine('console: ' + msg);
  }
};

var debug = function() {
  if (DEBUG) {
    console.log(arguments);
  }
};


// write output
var serializeTransactions = function(transactions) {
  if (OUT_FORMAT == 'json') {
    fs.write(OUT_FILE, JSON.stringify(transactions), 'w');
  } else {
    var file = fs.open(OUT_FILE, 'w');
    //file.writeLine('date,type,check number,description,withdrawal,deposit,balance');
    file.writeLine("Type,Trans Date,Post Date,Description,Amount,Medium,Balance");
    var i;
    for(i = 0; i < transactions.length; ++i) {
      var t = transactions[i];
      /*
      var str = t.date + ',' +
                t.type + ',' +
                t.checkNumber + ',"' +
                t.description + '","' +
                t.withdrawal + '","' +
                t.deposit + '","' +
                t.balance + '"';
                */

      var isWithdrawal = (t.withdrawal.indexOf("$") > -1) &&
                         (t.deposit.indexOf("$") == -1);

      var amount;
      if (isWithdrawal) {
        amount = "-" + t.withdrawal;
      } else {
        amount = t.deposit;
      }

      var str = t.type + ',' +
                ',' + // no trans date, just post date
                t.date + ',' +
                '"' + t.description + '",' +
                '"' + amount + '",' +
                'Schwab Checking' + ',' +
                '"' + t.balance + '"';

      file.writeLine(str)
    }
    file.close();
  }
};

