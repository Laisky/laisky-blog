$(function() {
    updatePageTitle();
    resizeImage();


    function updatePageTitle() {
        var title = $(".post-title a").html();
        $("head title").html(title);
    }
});