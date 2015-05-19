//XmlHttpRequest对象
function createXmlHttpRequest() {
    if (window.ActiveXObject) { //如果是IE浏览器
        return new ActiveXObject("Microsoft.XMLHTTP");
    } else if (window.XMLHttpRequest) { //非IE浏览器
        return new XMLHttpRequest();
    }
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
    var url = location.href; // entire url including querystring - also: window.location.href;
    var baseURL = url.substring(0, url.indexOf('/', 14));


    if (baseURL.indexOf('http://localhost') != -1) {
        // Base Url for localhost
        var url = location.href; // window.location.href;
        var pathname = location.pathname; // window.location.pathname;
        var index1 = url.indexOf(pathname);
        var index2 = url.indexOf("/", index1 + 1);
        var baseLocalUrl = url.substr(0, index2);

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


var globalFadeLayer = {};

$(function() {
    var $window = $(window);
    var $document = $(document);

    hljs.initHighlightingOnLoad();
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
            $loader.css("margin-left", (windowWidth - loaderSize)/2);
            $loader.css("margin-top", (windowHeight - loaderSize)/2);
        }
    }


    function initTopNavbar() {
        $(".navbar-top-btns a").each(function(idx, ele) {
            $(ele).on("click", function() {
                return false;
            })
        });
    }
});