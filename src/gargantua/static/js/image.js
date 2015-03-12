function resizeImage() {
    $("img").addClass('img-rounded');
    $("img").css("max-height", 600);
    $("img").css("max-width", 600);
    $.each($("img"), function(node) {
        var nd = $(node);
        var src = nd.prop("src");
        nd.wrap('<a href="' + src + '"></a>')
    });
}
