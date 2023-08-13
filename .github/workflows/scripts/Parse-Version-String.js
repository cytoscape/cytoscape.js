function getPatchVersion(str)
{
    if (typeof(str) != 'string') { return false; }

    var arr = str.split('.');

    // parse int or default to 0
    const maj = parseInt(arr[0]) || 0;
    const min = parseInt(arr[1]) || 0;
    const rest = parseInt(arr[2]) || 0;
    // console.log(arr[0], arr[1], arr[2], rest.toString().length);
    const label = str.substring(maj.toString().length + min.toString().length + rest.toString().length + 2);
    const newVersion = maj.toString() + '.' + min.toString() + '.' + (rest + 1).toString() + label;
    return newVersion;
}

function test() {
    const version = "3.22.0-unstable";
    const parsed = parseVersion(version);
    const expected = { major: 3, minor: 22, build: 0, label: 'unstable' };

    console.log(parsed, JSON.stringify(parsed) === JSON.stringify(expected));
}

const pjson = require('./package.json').version;
const newVersion = getPatchVersion(pjson);
console.log(newVersion);
