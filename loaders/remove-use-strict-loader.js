
module.exports = function (content) {
    this.cacheable && this.cacheable();

    return content.replace(/(['"])use strict\1;?/g, '');
};
