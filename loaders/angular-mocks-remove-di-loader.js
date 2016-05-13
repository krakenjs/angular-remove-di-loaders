var util = require('../lib/util');

/*
    Angular Mocks Remove DI Loader
    ------------------------------

    This module strips module() and inject() globals from
*/

function removeAngularMocksDI(angular) {

    // Make window.module() a noop

    window.module = angular.mock.module = function() {
        return function() {

        };
    };

    // Make window.inject() function as a regular angular injector

    window.inject = angular.mock.inject = function(method) {
        return function() {
            return angular.monolith.runInjector.invoke(method);
        };
    };
}

module.exports = function (content) {
    this.cacheable && this.cacheable();

    return content + '; (' + removeAngularMocksDI.toString() + ')(window.angular);';
};
