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

function exportProviders(angular) {
    angular && angular.exportProviders(module, exports, __dirname, __filename);
}

module.exports = function (content) {
    this.cacheable && this.cacheable();

    var registersAngularProviders = content.match(/\.(\s+)?(factory|service|provider|constant|value)\(/);
    var registersES6Exports = content.match(/export (var|let|function|constant|class) \$\w+/);

    if (registersAngularProviders && registersES6Exports) {
        throw new Error('Can not register ES6 exports and angular providers in the same module. If in doubt, use ES6 exports and angular-es6-interop will auto-generate angular providers for you.');
    }

    if (registersAngularProviders && content.indexOf('angular.mock') === -1) {
        content = content.replace(/([,;]\s+)?(?:return\s+)?((var\s+\w+\s+=\s+)?(\w+\.)?module\()/g, '$1\n\n\n(' + exportProviders.toString() + ')(window.angular);\n\n\n$2');
    }

    else if (registersES6Exports) {
        var exp = util.findAll('export\\s+(?:var|let|function|constant|class)\\s+([a-zA-Z0-9\\$_]+)', content);

        content = content + '\n' + exp.map(function(exportName) {

            var providerName = exportName;

            if (~LAZY_PROVIDERS.indexOf(providerName)) {
                providerName += 'Lazy';
            }

            return 'angular.value("' + providerName + '", ' + exportName + ');';
        }).join('\n')
    }

    var imports = util.findAll(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g, content);

    content = content + '\n' + imports.map(function(variableList) {
        return variableList.split(',').map(function(variable) {
            return variable.trim() + ';\n';
        }).join('\n');
    }).join('\n');

    return content;
};
