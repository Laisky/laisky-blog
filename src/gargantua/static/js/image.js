function resizeImage() {
    $(".post-content img").addClass('img-rounded');
    $.each($("img"), function(node) {
        var nd = $(node);
        var src = nd.prop("src");
        nd.wrap('<a href="' + src + '"></a>')
    });
}