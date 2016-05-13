
Angular Webpack Remove DI Loaders
---------------------------------

## Rationale

This module is for you if:

- You're using angular 1.x
- You want to use ES6 imports and exports

But you're in the unfortunate situation where:

- You have a bunch of angular modules, with factories, services, providers, etc.
- You're using a bunch of dependencies from angular, like `$q` and `$http`
- You hate all of this boilerplate and you don't feel like angular dependency injection gives you enough value

Basically, if you have code that looks something like this:

```javascript
define('my-module', [

    'angular';
    'some-dependency/foo',
    './some-local-dependency/bar'

], function() {

    return angular.module('my-module', [
        'foo',
        'bar',
        'baz'
    ]).factory('someHelper', function someHelperFactory($q, $foo) {

        return function someHelper() {
            // do something
        }
    }).factory('someUtil', function someUtilFactory($http, $bar) {

        return function someUtil() {
          // do something else
        }
    });;
});
```

And you'd prefer it to look like this:

```javascript
import { $q, $http } from 'angular';

import { $foo } from 'some-dependency/foo';
import { $bar } from './some-local-dependency/bar';

export function someHelper() {
   // do something
}

export function someUtil() {
    // do something else
}
```

## Usage

#### 1. Make sure you're using webpack. Babel and ES6 is recommended, but it should probably also work (at your own peril) with commonjs.

#### 2. Add the following webpack config:

```javascript

// Make sure we're exposing __dirname and __filename in our modules

node: {
    __dirname: true,
    __filename: true
},

// Point webpack to the righr place to find our loaders

resolveLoader: {
    modulesDirectories: [
        require('path').dirname(require.resolve('angular-webpack-remove-di-loaders/loaders'))
    ]
},

// Include angular-es6-interop for all client code using angular dependencies, and es6 imports and exports

preLoaders: [
    {
        test: /\.js/,
        loader: 'angular-es6-interop',
        exclude: /node_modules|jquery|angular(\.min)?\.js|\.build/
    }
],

// Include angular-remove-di for angular.js

loaders: [
    {
        test: /angular(\.min)?\.js/,
        loader: 'exports?angular!imports?uiShims!angular-remove-di'
    },
]
```

#### 3. Make sure you bootstrap angular before any of your app code is imported!

This works best if you have a `bootstrap.js` like the following:

```javascript:
require('angular')
require('angular-ui-router')

angular.bootstrap(document.body, ['app']);

require('./app.js');
```

#### 4. You're good to go!

## Writing code

All of angular's providers can be imported directly from angular:

```javascript
import { $q, $http, $timeout } from 'angular';
```

Any of your ES6 exports will be usable as angular factories:

##### foo.js

```javascript
export var $foo = 'bar';
```

##### bar.js

```javascript
import './foo';

angular.module().factory('$bar', function($foo) {
    ...
});
```

And any any of your angular factories will be usable as ES6 imports:

##### bar.js

```javascript
angular.module().factory('$bar', function() {
    ...
});
```

##### foo.js

```javascript
import { $bar } from './bar';
```

This way, you can incrementally remove angular modules, and transition to pure unbridled ES6 joy without having to re-write your whole app from scratch.

Enjoy!