Schwab Scraper
==============

This is a rudimentary brute-force scraper to grab transaction data from
a Schwab.com checking account and write the output in CSV.

There's some (currently unused) code in there to attempt modularity (like
writing to JSON, or supporting different CSV formats), but it's half-baked.

Mostly, I put this together since Schwab doesn't have a "Download as CSV"
option like other banks do, and this is a good first-step to treating their
website as an API to use in my own personal financing application.

Usage
=====

```bash
$ npm install
$ phantomjs --ssl-protocol=any scrape.js
```

This will save your transactions to a file `transactions.csv`.  Have a look at
the code to change the "go back to" date, or change the default output format.


You'll need to provide your username and password to login to your Schwab
account, but as you can see in the code, it's not stored (except for maybe in
your terminal history, since I couldn't figure that part of `system.stdin` out
for phantomjs), and it's not sent anywhere else.

