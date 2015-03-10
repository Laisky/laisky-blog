$(function() {
    loadLastPosts();
});


function prettyImg() {
    $("img").addClass('img-rounded');
    $("img").css("max-height", 600);
    $("img").css("max-width", 600);
    $.each($("img"), function(node) {
        var nd = $(node);
        var src = nd.prop("src");
        nd.wrap('<a href="' + src + '"></a>')
    });
}

function loadLastPosts() {
    var url = location.protocol + '//' + location.host + "/api/posts/get-lastest-posts";
    var data = {'n': 5, '_': Math.random()};

    $.getJSON(url, data, function(data) {
        console.log(data['status']);
    })
        .done(function(data) {
            $("#archives").html(data['data'])
            hljs.initHighlightingOnLoad();
            prettyImg();
        });
}
