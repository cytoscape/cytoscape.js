/**
 * $versions - Test your code/plugin in multiple jQuery versions
 * Works perfectly together with QUnit and other test libraries
 *
 * @example
 *    $versions("1.4.3", "1.5").load("/js/jquery.myCoolPlugin.js").execute(function(jQuery, $, version) {
 *      module("jquery.myCoolPlugin in jQuery v" + version);
 *      test("Basic test", function() {
 *        expect(1);
 *        ok($.myCoolPlugin("foo"), "Works");
 *      });
 *    });
 */
var $versions = (function() {
  
  var // location.protocol can be file:, that why we either take http: or https:
      protocol     = location.protocol == "https:" ? location.protocol : "http:",
      // cache buster needed to bypass browser cache when loading most recent branch version
      cacheBuster  = new Date().getTime(),
      URL_TEMPLATE = protocol + "//ajax.googleapis.com/ajax/libs/jquery/{version}/jquery.min.js?" + cacheBuster;
  
  var _makeArray = function(pseudoArray) {
    var array = [];
    if (pseudoArray && pseudoArray.length) {
      for (var i=0; i<pseudoArray.length; i++) {
        array.push(pseudoArray[i]);
      }
    }
    return array;
  };
  
  var _cloneArray = _makeArray;
  
  var _isArray = function(array) {
    return Object.prototype.toString.call(array) === "[object Array]";
  };
  
  var _loadScript = function(url, callback) {
    var script = document.createElement("script"),
        existingScript;
    script.async = true;
    script.src = url;
    script.onload = function() {
      callback();
      script.onload = script.onreadystatechange = null;
      script.parentNode.removeChild(script);
      script = null;
    };
    script.onerror = function() {
      throw new Error("$versions: File '" + url + "' couldn't be loaded!");
    };
    script.onreadystatechange = function() {
      if (/complete|loaded/.test(script.readyState)) { script.onload(); }
    };
    
    existingScript = document.getElementsByTagName("script")[0];
    existingScript.parentNode.insertBefore(script, existingScript);
  };
  
  var _loadScripts = function(urls, callback) {
    urls = _cloneArray(urls);
    var loadNext = function() {
      if (urls.length) {
        _loadScript(urls.shift(), loadNext);
      } else {
        callback();
      }
    };
    loadNext();
  };
  
  var _loadJquery = function(version, callback) {
    var url = URL_TEMPLATE.replace("{version}", version);
    _loadScript(url, callback);
  };
  
  
  var VersionRunner = function(versions) {
    this.versions         = versions;
    this.scripts          = [];
    this.callbackMethods  = [];
    return this;
  };
  
  VersionRunner.prototype.add = function(version) {
    this.versions.push(version);
    return this;
  }; 
  
  VersionRunner.prototype.load = function(scripts) {
    scripts = _isArray(scripts) ? scripts : _makeArray(arguments);
    this.scripts = this.scripts.concat(scripts);
    return this;
  };
  
  VersionRunner.prototype.execute = function(testExecuter) {
    var versions        = _cloneArray(this.versions),
        that            = this,
        loadNextJquery  = function() {
          if (versions.length) {
            _loadJquery(versions.shift(), function() {
              _loadScripts(that.scripts, function() {
                var currentJquery  = window.jQuery,
                    version        = currentJquery.fn.jquery;
                testExecuter(currentJquery, currentJquery, version);
                
                // Clean up afterwards
                currentJquery.noConflict(true);
                loadNextJquery();
              });
            });
          } else {
            for (var i=0; i<that.callbackMethods.length; i++) {
              that.callbackMethods[i]();
            }
          }
        };
    
    loadNextJquery();
    return this;
  };
  
  VersionRunner.prototype.callback = function(method) {
    this.callbackMethods.push(method);
    return this;
  };
  
  return function(versions) {
    versions = _isArray(versions) ? versions : _makeArray(arguments);
    return new VersionRunner(versions);
  };
})();