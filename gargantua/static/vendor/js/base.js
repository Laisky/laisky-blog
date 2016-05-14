'use strict';

// isArray for ES3
var isArray = Function.isArray || function(o) {
    return typeof o === 'object' &&
        Object.prototype.toString.call(o) === '[object Array]';
};

/**
 * inherit from parent
 */
function inherit(p) {
    if (p == null) throw TypeError();
    if (Object.create) return Object.create(p);
    var t = typeof p;
    if (t !== 'object' && t !== 'function') throw TypeError();

    function f() {}
    f.prototype = p;
    return new f();
}

// http://stackoverflow.com/a/18234568
if (!Array.average) {
    Array.prototype.average = function() {
        var sum = 0;
        var j = 0;
        for (var i = 0; i < this.length; i++) {
            if (isFinite(this[i])) {
                sum = sum + parseFloat(this[i]);
                j++;
            }
        }
        if (j === 0) {
            return 0;
        } else {
            return sum / j;
        }
    }
}

Array.join = Array.join || function(a, f, thisArg) {
    return Array.prototype.join.call(a, sep)
}

Array.slice = Array.slice || function(a, from, to) {
    return Array.prototype.slice.call(a, from, to)
}

Array.map = Array.map || function(a, f, thisArg) {
    return Array.prototype.map.call(a, f, thisArg)
}

// IE7 Array.indexOf
if (!Array.indexOf) {
    Array.prototype.indexOf = function(obj) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == obj) {
                return i;
            }
        }
        return -1;
    }
}

//XmlHttpRequest对象
function createXmlHttpRequest() {
    if (window.ActiveXObject) { //如果是IE浏览器
        return new ActiveXObject("Microsoft.XMLHTTP");
    } else if (window.XMLHttpRequest) { //非IE浏览器
        return new XMLHttpRequest();
    }
}

function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}


// navigator.browserInfo
// http://stackoverflow.com/questions/5916900/how-can-you-detect-the-version-of-a-browser
navigator.browserInfo = (function() {
    var ua = navigator.userAgent,
        tem,
        M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(M[1])) {
        tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
        return 'IE ' + (tem[1] || '');
    }
    if (M[1] === 'Chrome') {
        tem = ua.match(/\bOPR\/(\d+)/);
        if (tem != null) return 'Opera ' + tem[1];
    }
    M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
    if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);
    return {
        "name": M[0],
        "version": M[1]
    }
})();


if (!String.prototype.getMD5) {
    String.prototype.getMD5 = function() {
        return SparkMD5.hash(this);
    };
}


function getBaseUrl() {
    var url = location.href, // entire url including querystring - also: window.location.href;
        baseURL = url.substring(0, url.indexOf('/', 14));


    if (baseURL.indexOf('http://localhost') != -1) {
        // Base Url for localhost
        var pathname = location.pathname,
            index1 = url.indexOf(pathname),
            index2 = url.indexOf("/", index1 + 1),
            baseLocalUrl = url.substr(0, index2);

        return baseLocalUrl + "/";
    } else {
        // Root Url for domain name
        return baseURL + "/";
    }

}


// 方便的 POST JSON 的函数
// 包含 xsrf 信息
// 注意链式语法中的 done, fail, always 等接收到的参数是字符串
jQuery.postJSON = function(url, args, callback) {
    args._xsrf = getCookie("_xsrf");
    return $.ajax({
        url: url,
        data: $.param(args),
        dataType: "text",
        type: "POST",
        success: function(response) {
            callback(eval("(" + response + ")"));
        }
    });
};


/**
 * Get url params by javascript
 * http://stackoverflow.com/posts/979995/revisions
 */
var QueryString = function() {
    // This function is anonymous, is executed immediately and
    // the return value is assigned to QueryString!
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined") {
            query_string[pair[0]] = decodeURIComponent(pair[1]);
            // If second entry with this name
        } else if (typeof query_string[pair[0]] === "string") {
            var arr = [query_string[pair[0]], decodeURIComponent(pair[1])];
            query_string[pair[0]] = arr;
            // If third or later entry with this name
        } else {
            query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
    }
    return query_string;
}();


var globalFadeLayer = {};

$(function() {
    var $window = $(window);
    var $document = $(document);

    // hljs.initHighlightingOnLoad();
    // initTopNavbar();
    initGlobalLoader();


    function initGlobalLoader() {
        var $globalFade = $(".global-fade");
        var $loader = $(".global-fade .loader-inner");
        var loaderSize = 50;
        var loaders = [
            '<div class="loader-inner ball-scale-ripple-multiple"></div>'
        ];

        globalFadeLayer.fadeIn = function() {
            setLoaderIconCenter();
            $globalFade.fadeIn();
            setTimeout(globalFadeLayer.fadeOut, 10000);
        };
        globalFadeLayer.fadeOut = function() {
            $globalFade.fadeOut(1);
        }

        function setLoaderIconCenter() {
            var windowHeight = parseInt($window.height(), 10);
            var windowWidth = parseInt($window.width(), 10);

            // make sure fade overlay whole document
            $globalFade.height($document.height());
            $globalFade.width($document.width());

            // set center
            $loader.css("margin-left", (windowWidth - loaderSize) / 2);
            $loader.css("margin-top", (windowHeight - loaderSize) / 2);
        }
    }
});
