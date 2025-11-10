# WebdriverIO + TypeScript + Mocha + Allure

Minimal, strictly-typed WebdriverIO v9 setup using the DevTools protocol, Mocha framework, and Allure reporting.

## Prerequisites

- Node.js 20+
- Google Chrome installed (used via DevTools protocol)
- Java (only required to generate/open Allure HTML reports)

## Install

```
npm install
```

## Run tests

```
npm test
```

This creates raw Allure results in `./allure-results`.

## Allure HTML report

Allure CLI requires Java. After installing Java:

```
npm run allure:generate
npm run allure:open
```

The report is generated to `./allure-report` and opened locally.

