
/*
    Angular Remove DI Loader
    ------------------------

    This module strips the dependency injection from angular, allowing you to import and export angular dependencies as regular ES6 imports
*/

function removeAngularDI(angular) {

    // Provider types on angular.module() which we need to shim to allow registering modules lazily

    var ANGULAR_PROVIDER_TYPES = [
        'factory',
        'service',
        'constant',
        'provider',
        'value'
    ];


    // List of angular providers we'll register to import from angular. No way to get these programatically so need to hard-code the list

    var ANGULAR_PROVIDERS = [
        '$window', '$document', '$provide', '$rootElement', '$compileProvider', '$rootScope', '$compile', '$injector',
        '$locationProvider', '$animateProvider', '$filterProvider', '$controllerProvider', '$http', '$log',
        '$location', '$anchorScroll', '$animate', '$q', '$sniffer', '$cacheFactory', '$exceptionHandler',
        '$interpolate', '$templateRequest', '$parse', '$controller', '$sce', '$httpParamSerializerJQLike', '$timeout',
        '$httpParamSerializer', '$httpBackend', '$templateCache', '$xhrFactory', '$browser', '$interval', '$sanitize',
        '$filter', '$sceDelegate'
    ];


    // Mapping of provider type -> lazy registrar

    var LAZY_PROVIDER_REGISTRARS = {
        provider: '$provide',
        factory: '$provide',
        service: '$provide',
        constant: '$provide',
        value: '$provide',
        decorator: '$provide',
        controller: '$controllerProvider',
        directive: '$compileProvider',
        filter: '$filterProvider',
        animation: '$animationProvider'
    };


    // Providers we need to auto-register

    var DEFAULT_PROVIDERS = [
        {
            type: 'constant',
            name: 'uiAliasConfig',
            value: {}
        }
    ];


    // Providers we make 'lazy' so we're able to register over them after bootstrap

    var LAZY_PROVIDERS = [
        '$exceptionHandler',
        '$sanitize'
    ];


    // Default values for lazy providers.

    var DEFAULT_LAZY_PROVIDERS = {
        $exceptionHandler: function(err) {
            throw err;
        }
    }


    // Create our 'monolith', which is a singleton angular module which **everything** will be registered under

    function createMonolith(angular) {

        if (angular.monolith) {
            return;
        }

        var monolith = angular.module('app', []);

        registerMonolithSingleton(angular, monolith);
        registerAngularExports(angular, monolith);
        registerSupplementaryAngularFactories(angular, monolith);
        registerLazyProviderRegistrars(angular, monolith);
        registerShimProviders(angular, monolith);
        registerProviderExporter(angular, monolith);

        monolith.config(function() {
            registerLazyProviders(angular, monolith);
        });

        registerBootstrapShim(angular, monolith, function() {
            registerProviderExporter(angular, monolith);
        });

        angular.monolith = monolith;

        return monolith;
    }


    // Attach monolith to angular, so any call to angular.module() will get our singleton module
    // This means that modules can transition away from angular modules without worrying about keeping their angular module names in check
    // Anything like `angular.module('foo.bar.baz', ['dep1', 'dep2'])` can just be refactored to `angular.module()`

    function registerMonolithSingleton(angular, monolith) {

        angular.module = function(name) {
            return monolith;
        };
    }


    // Register our static list of angular providers as exports on the angular module, so we can import them directly
    // After this we will be able to do `import { $foo } from 'angular'`

    function registerAngularExports(angular, monolith) {
        ANGULAR_PROVIDERS.forEach(function(providerName) {
            registerExport(monolith, {exports: angular}, providerName, 'angular');
        });
    }


    // Add a $registerDirective export on angular so we can avoid using angular.module() syntax for registering directives
    // $registerDirective('my-tag-name', { controller() { ... } });

    function registerSupplementaryAngularFactories(angular, monolith) {

        angular['$registerDirective'] = function(tag, definition) {

            // Convert dasherized tagname to camelcase, to adhere with angular convention
            var directiveName = tag.replace(/-([a-z])/g, function (g) {
                return g[1].toUpperCase();
            });

            return monolith.directive(directiveName, definition);
        };
    }


    // Make sure any calls to angular.module().controller, angular.module().factory etc. will still work even after angular has bootstrapped
    // To do this we monkey patch these methods to use their lazy equivalents, e.g. $provide.factory() which can be used at any time

    function registerLazyProviderRegistrars(angular, monolith) {

        monolith.config(['$injector', function($injector) {

            // Save a reference to the config-time $injector, which is different to the run-time $injector in weird and mysterious ways

            monolith.injector = monolith.configInjector = $injector;

            // Set up angular.value for later as a shortcut for registering new angular providers on the fly. E.g. angular.value('$foo', 'bar')

            var $provide = $injector.get('$provide');

            angular.value = function(name, value) {
                $provide.value(name, value);
                return angular;
            }

            // Register each of .directive() .factory() etc. on our singleton module so registering stuff works even after bootstrap time

            Object.keys(LAZY_PROVIDER_REGISTRARS).forEach(function(providerType) {
                monolith[providerType] = function(name) {
                    var provider = $injector.get(LAZY_PROVIDER_REGISTRARS[providerType]);
                    var register = provider[providerType] || provider.register;
                    register.apply(provider, arguments);
                    return this;
                }
            });
        }]);

        monolith.run(['$injector', function($injector) {

            // Save a reference to the run-time $injector for later (could be useful right?)

            monolith.injector = monolith.runInjector = $injector;
        }]);
    }


    // Auto-register these configured providers. To avoid issues since we immediately invoke any .run() or .config() blocks, and ui-utils requires this

    function registerShimProviders(angular, monolith) {
        DEFAULT_PROVIDERS.forEach(function(shimProvider) {
            monolith[shimProvider.type].call(monolith, shimProvider.name, shimProvider.value);
        });
    }


    // Monkey patch angular.bootstrap() to do additional awesome stuff

    function registerBootstrapShim(angular, monolith, callback) {

        var bootstrapped = false;

        var bootstrap = angular.bootstrap.bind(angular);

        angular.bootstrap = function() {

            // Make sure we only bootstrap once

            if (angular.bootstrapped) {
                return;
            }

            angular.bootstrapped = true;

            bootstrap.apply(this, arguments);

            // Set up any future .run() and .config() blocks to immediately execute, since we're already bootstrapped
            // (This is why we needed to save references to the config-time and run-time injectors)

            monolith.run = function(handler) {
                monolith.runInjector.invoke(handler);
                return this;
            };

            monolith.config = function(handler) {
                monolith.configInjector.invoke(handler);
                return this;
            };

            callback();
        };
    }


    // OK, previously we set up angular.module().factory, angular.module().directive to work lazily, right?
    // This is good, but we need more. We need to be able to set these methods up so that they do ES6 exports
    // This method sets up angular.exportProviders to help with this

    function registerProviderExporter(angular, monolith) {

        // Save the default lazy methods for each provider type in advance, so we don't monkey patch too many levels deep

        var registerProvider = {};

        ANGULAR_PROVIDER_TYPES.forEach(function(providerType) {
            registerProvider[providerType] = monolith[providerType].bind(monolith);
        });

        // If a module calls `angular.exportProviders(module, module.exports, dirname, filename)` with the globals generated by webpack,
        // we can set up any factory calls to automatically add ES6 exports too. This method call will be automatically inserted by angular-es6-interop-loader

        angular.exportProviders = function(module, exports, dirname, filename) {
            ANGULAR_PROVIDER_TYPES.forEach(function(providerType) {

                monolith[providerType] = function(providerName, provider) {

                    // Make sure the run-time registered provider has the right name if it's considered 'lazy' (see docs for `registerLazyProviders`)

                    if (~LAZY_PROVIDERS.indexOf(providerName)) {
                        providerName += 'Lazy';
                    }

                    // Register the provider with angular

                    var result = registerProvider[providerType].apply(this, arguments);

                    // Set up ES6 exports for the provider

                    registerExport(monolith, module, providerName, filename);

                    if (providerType === 'provider') {
                        registerExport(monolith, module, providerName + 'Provider', filename);
                    }

                    return result;
                };
            });
        };
    }


    // Here we pre-emptively register certain providers that we know we'll probably want to override at runtime.
    //
    // If you need to register over one of the existing angular providers like $exceptionHandler, we have to be a little sly here.
    // We can't actually *overwrite* any providers after bootstrap (if you find a way please tell me), so instead we register
    // it with a *different* name *before* bootstrap time, like $originalNameLazy.
    //
    // In registerLazyProviders, we've already overwritten those providers in advance, *before* bootstrap time, so we can
    // delegate to lazy providers registered at run-time if they're registered.
    //
    // Clear as mud, right? This could all go away if angular would let us overwrite providers at runtime, after bootstrap.
    // Although that probably wouldn't work as a lot of angular framework factories end up with static references to things like
    // $exceptionHandler, so there's no way to reach into closure scope and replace those.

    function registerLazyProviders(angular, monolith) {
        LAZY_PROVIDERS.forEach(function(providerName) {

            monolith.factory(providerName, ['$injector', function($injector) {
                return function() {

                    var provider;

                    // First try to get a provider with the name $providerLazy

                    try {
                        provider = $injector.get(providerName + 'Lazy');
                    }

                    // Otherwise try to get a value from DEFAULT_LAZY_PROVIDERS

                    catch (err) {
                        if (DEFAULT_LAZY_PROVIDERS[providerName]) {
                            provider = DEFAULT_LAZY_PROVIDERS[providerName];
                        }

                        // Otherwise fail hard

                        else {
                            throw new Error('Unable to find provider: ' + providerName);
                        }
                    }

                    // TODO: Can we use a decorator here and just return the original value if we can't find a lazy value..?

                    return provider.apply(this, arguments);
                }
            }]);
        });
    }


    // Register a lazy export on a module

    function registerExport(monolith, module, name, filename) {

        if (!(module.exports instanceof Object)) {
            module.exports = {};
        }

        // Fail hard with a decent error message if the export already exists

        if (module.exports.hasOwnProperty(name)) {
            throw new Error('Module ' + filename + ' already has property: ' + name);
        }

        // Define a lazy export. Why lazy? Because we don't want to immediately call the factory function. Bad things
        // could happen: it could have dependencies which aren't registered yet (yay angular), angular might not yet be bootstrapped,
        // basically it's a minefield. So we'll resolve these at import time instead.

        Object.defineProperty(module.exports, name, {
            get: function() {

                if (!angular.bootstrapped) {
                    throw new Error('Angular must be bootstrapped to require any of its dependencies via ES6: ' + name);
                }

                // Go by angular's wonderful $x and $xProvider naming conventions. What could go wrong?

                var injector = (name === '$provide' || ~name.indexOf('Provider')) ? monolith.configInjector : monolith.runInjector;

                var value = injector.get(name);

                // Write over the export, so we don't have to do this lookup next time it's imported

                delete module.exports[name];
                module.exports[name] = value;

                return value;
            },
            configurable: true
        });
    }

    createMonolith(angular);
}


module.exports = function (content) {
    this.cacheable && this.cacheable();

    return content + '; (' + removeAngularDI.toString() + ')(window.angular);';
};
