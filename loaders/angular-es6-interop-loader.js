var util = require('../lib/util');

/*
    Angular ES6 Interop Loader
    --------------------------

    This module:

    - Allows angular factories / providers to be imported via ES6 imports
    - Allows ES6 imports to be included as DI dependencies in angular factories / providers
*/


var LAZY_PROVIDERS = [
    '$exceptionHandler',
    '$sanitize'
];


// This method will be inserted into any module with angular factories, services, etc. in order to turn them into ES6 exports

function exportProviders(angular) {
    angular && angular.exportProviders(module, exports, __dirname, __filename);
}

module.exports = function (content) {
    this.cacheable && this.cacheable();

    // Do we have any angular providers?

    var registersAngularProviders = content.match(/\.(\s+)?(factory|service|provider|constant|value)\(/);

    // Do we have any ES6 imports?

    var registersES6Exports = content.match(/export (var|let|function|const|class) \$\w+/);

    if (registersAngularProviders && registersES6Exports) {
        throw new Error('Can not register ES6 exports and angular providers in the same module. If in doubt, use ES6 exports and angular-es6-interop will auto-generate angular providers for you.');
    }

    // If we do, insert `exportProviders` after the .module() definition

    if (registersAngularProviders && content.indexOf('angular.mock') === -1) {
        content = content.replace(/([,;]\s+)?(?:return\s+)?((var\s+\w+\s+=\s+)?(\w+\.)?module\()/g, '$1\n\n\n(' + exportProviders.toString() + ')(window.angular);\n\n\n$2');
    }

    // Or if we're in an ES6 file...

    else if (registersES6Exports) {

        // Find all of the exports

        var exp = util.findAll('export\\s+(?:var|let|function|const|class)\\s+([a-zA-Z0-9\\$_]+)', content);

        // Map them to angular providers using our angular.provider shorthand

        content = content + '\n' + exp.map(function(exportName) {

            var providerName = exportName;

            // Make sure any lazy providers are correctly named, since this code will run post-bootstrap

            if (~LAZY_PROVIDERS.indexOf(providerName)) {
                providerName += 'Lazy';
            }

            return 'angular.value("' + providerName + '", ' + exportName + ');';
        }).join('\n')
    }

    // We also want to try to resolve any ES6 import. This is so factory/provider functions  are all
    // run at import time, rather than when the dependency is used in code for the first time - so we'll fail earlier if
    // there are any dependency errors

    var imports = util.findAll(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g, content);

    content = content + '\n' + imports.map(function(variableList) {
        return variableList.split(',').map(function(variable) {
            return variable.trim() + ';\n';
        }).join('\n');
    }).join('\n');

    return content;
};
