# Sanity

Sanity is a CMS a construction kit with a rich data model and real-time collaboration.

This repository contains the core Sanity front-end modules. It uses [Lerna](https://lernajs.io/) to manage cross-dependencies, publishing and to simplify workflows.

** Note: ** Sanity is pre-release software with daily releases. APIs are still in flux.

Unless you want to modify/contribute to the core Sanity components, you're probably better off having a look at the [Sanity documentation](http://sanity.io/docs/) that explains how to quickly get started using our hosted backend.

## Installing

```
git clone git@github.com:sanity-io/sanity.git
cd sanity
npm install
npm run bootstrap
npm start
```

## Publishing

```
npm run publish
```

## Issues?

If you run into build issues, you might want to run `npm run clean`, which will delete all `node_modules` folders, then run a fresh `npm run bootstrap` to install and cross-symlink all modules.

## Testing

```
npm test
```

Note: this runs `npm test` for all the Sanity packages - the output can be quite hard to read. If you encounter an issue, it's usually best to figure out which module is failing, then run `npm test` in that individual module.

