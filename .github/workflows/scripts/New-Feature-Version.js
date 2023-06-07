function getFeatureVersion(str)
{
    if (typeof(str) != 'string') { return false; }

    var arr = str.split('.');

    // parse int or default to 0
    const maj = parseInt(arr[0]) || 0;
    const min = parseInt(arr[1]) || 0;
    const rest = 0;
    // console.log(arr[0], arr[1], arr[2], rest.toString().length);
    
    // For an feature release, this step would be run after merging of master and unstable has been done.
    // This means new version from unstable would be present already, only the "unstable" needs to be removed
    const newVersion = maj.toString() + '.' + min.toString() + '.' + rest.toString();
    return newVersion;
}


var arguments = process.argv

if (arguments.length < 3)
{
    const pjson = require('./package.json').version;
    const newVersion = getFeatureVersion(pjson);
    console.log(newVersion);
}
else {
    const newVersion = getFeatureVersion(arguments[2]);
    console.log(newVersion);
}
