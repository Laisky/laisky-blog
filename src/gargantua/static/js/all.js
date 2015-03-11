
var imgFuncs = {
    'prettyImg': function() {
        $("img").addClass('img-rounded');
        $("img").css("max-height", 600);
        $("img").css("max-width", 600);
        $.each($("img"), function(node) {
            var nd = $(node);
            var src = nd.prop("src");
            nd.wrap('<a href="' + src + '"></a>')
        });
    }
};


var postFuncs = {
    'loadLastPosts': function() {
        var url = getHostUrl() + "/api/posts/get-lastest-posts";
        var data = {
            'n': 5,
            '_': Math.random()
        };

        $.getJSON(url, data, function(data) {
                console.log(data['status']);
            })
            .done(function(data) {
                $("#archives").html(data['data'])
                hljs.initHighlightingOnLoad();
                imgFuncs.prettyImg();
            });
    }
};