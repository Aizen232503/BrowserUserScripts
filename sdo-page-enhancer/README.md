# SDO Page Enhancer

A combined Tampermonkey userscript for supported SDO payment and login pages.

## Features

### FF14 recharge page

- Restores editing of the recharge account field when it is disabled on the client side.

### SDO login page

- Automatically accepts the privacy policy and service agreement checkbox.
- Handles checkboxes that are added after the initial page load.

Each feature runs only on its corresponding page.

## Supported Pages

- `*://pay.sdo.com/item/GWPAY-100001900*`
- `https://login.u.sdo.com/sdo/iframe/*`

## Install

Open [`sdo-page-enhancer.user.js`](./sdo-page-enhancer.user.js) in a browser with Tampermonkey installed.
