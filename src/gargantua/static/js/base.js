$(function() {
    $(window).resize(set_welcome_in_center);
    set_welcome_in_center();
    hljs.initHighlightingOnLoad();
});


function set_welcome_in_center() {
    $("#welcome").css("left", $(window).width() / 2 - 57);
}


//XmlHttpRequest对象
function createXmlHttpRequest() {
    if (window.ActiveXObject) { //如果是IE浏览器
        return new ActiveXObject("Microsoft.XMLHTTP");
    } else if (window.XMLHttpRequest) { //非IE浏览器
        return new XMLHttpRequest();
    }
}

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


function getBaseURL() {
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


jQuery.postJSON = function(url, args, callback) {
    args._xsrf = getCookie("_xsrf");
    $.ajax({
        url: url,
        data: $.param(args),
        dataType: "text",
        type: "POST",
        success: function(response) {
            callback(eval("(" + response + ")"));
        }
    });
};


function getHostUrl() {
    return location.protocol + '//' + location.host;
}