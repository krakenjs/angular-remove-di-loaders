
module.exports.findAll = function findAll(regex, string, unique) {

    if (!(regex instanceof RegExp)) {
        regex = new RegExp(regex, 'g');
    }

    var matches = [];

    while(true) {
        var match = regex.exec(string);

        if (!match)
            break;
        if (typeof match[1] !== 'undefined')
            matches.push(match[1]);
        else if (typeof match[0] !== 'undefined')
            matches.push(match[0]);
        else
            break;
    }

    return matches;
}

module.exports.dedupe = function dedupe(collection) {
    var result = [];
    for (var i=0; i < collection.length; i++) {
        if (!~result.indexOf(collection[i])) {
            result.push(collection[i]);
        }
    }
    return result;
}
