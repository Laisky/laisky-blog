$(function() {
    loadLastPosts();
});


function loadLastPosts() {
    var url = location.protocol + '//' + location.host + "/api/posts/get-lastest-posts";
    var data = {'n': 5, '_': Math.random()};

    $.getJSON(url, data, function(data) {
        console.log(data['status']);
    })
        .done(function(data) {
            $("#archives").html(data['data'])
            hljs.initHighlightingOnLoad();
        });
}
